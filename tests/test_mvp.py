import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import date
from pathlib import Path
from unittest.mock import patch
from app.db import connect, initialize, ROOT
from app.ingest import run, store, import_river, import_noaa, import_nasa
from app.series import series, compare


class DataTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'tests')
        self.raw_root=patch('app.ingest.ROOT',Path(self.tmp.name))
        self.raw_root.start()
        self.db=connect(str(Path(self.tmp.name)/'test.sqlite'))
        initialize(self.db)
        self.station=self.db.execute('SELECT * FROM station WHERE id="power-ibirama"').fetchone()

    def tearDown(self):
        self.db.close();self.raw_root.stop();self.tmp.cleanup()

    def load(self,rows):
        def consume(raw,run_id,counts):
            for day,value,unit in rows: store(self.db,self.station,day,value,unit,run_id,counts)
        return run(self.db,'nasa','fixture: controlled unit test, NOT observed data',lambda:b'test-only',consume)

    def test_zero_gap_monthly_sum_and_daily_gap(self):
        self.load([('2024-02-01',0,'mm'),('2024-02-02',10,'mm'),('2024-02-04',20,'mm')])
        result=series(self.db,self.station['id'],date(2024,2,1),date(2024,2,29))
        self.assertEqual(result['points'][0]['value'],30)
        self.assertEqual((result['valid'],result['expected'],result['missing']),(3,29,26))
        self.assertTrue(result['points'][0]['partial'])
        daily=series(self.db,self.station['id'],date(2024,2,1),date(2024,2,4),'daily')
        self.assertEqual([p['value'] for p in daily['points']],[0,10,None,20])

    def test_invalid_sentinel_duplicates_and_revision(self):
        rows=[('2024-01-01',0,'mm'),('2024-01-02',-999,'mm'),('2024-01-03',5,'in'),('2024-02-30',1,'mm'),('2024-01-04','nan','mm')]
        r=self.load(rows)
        self.assertEqual((r['inserted'],r['rejected'],r['status']),(1,4,'parcial'))
        self.assertEqual(self.load(rows)['duplicates'],1)
        r=self.load([('2024-01-01',2,'mm')])
        self.assertEqual(r['updated'],1)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM measurement').fetchone()[0],1)

    def test_failure_rolls_back_and_keeps_history(self):
        self.load([('2024-01-01',5,'mm')])
        def consume(raw,run_id,counts):
            store(self.db,self.station,'2024-01-01',9,'mm',run_id,counts)
            raise ValueError('broken batch')
        r=run(self.db,'nasa','fixture',lambda:b'broken',consume)
        self.assertEqual(r['status'],'falha')
        self.assertEqual(self.db.execute('SELECT value FROM measurement').fetchone()[0],5)
        with patch('app.ingest.fetch',side_effect=TimeoutError('offline')):
            r=import_nasa(self.db,self.station['id'],date(2024,1,1),date(2024,1,2))
        self.assertEqual(r['status'],'falha')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM measurement').fetchone()[0],1)

    def test_river_cm_mean_and_unknown_datum(self):
        path=Path(self.tmp.name)/'river.csv';path.write_text('date,value\n2024-01-01,100\n2024-01-02,300\n2024-01-03,\n',encoding='utf-8')
        meta=dict(code='TEST-NOT-REAL',name='TEST ONLY',latitude=0,longitude=0,reference='https://example.org/test-only',unit='cm',statistic='daily_mean')
        r=import_river(self.db,path,meta)
        self.assertEqual((r['inserted'],r['rejected']),(2,1))
        s=series(self.db,'ana-TEST-NOT-REAL',date(2024,1,1),date(2024,1,3))
        self.assertEqual(s['points'][0]['value'],2)
        self.assertEqual(s['unit'],'m')
        self.assertIsNone(s['station']['datum'])
        meta['unit']='feet'
        with self.assertRaises(ValueError): import_river(self.db,path,meta)

    def test_current_common_cutoff(self):
        self.load([('2026-01-10',1,'mm'),('2023-01-01',2,'mm')])
        windows=[dict(id='a',label='a',start=date(2023,1,1),end=date(2023,12,31)),
                 dict(id='current',label='Atual',start=date(2026,1,1),end=date(2026,10,21),current=True)]
        for resolution in ['daily','monthly']:
            result=compare(self.db,[self.station['id']],windows,resolution)
            self.assertEqual([s['end'] for s in result['series']],['2023-01-10','2026-01-10'])
            self.assertEqual(result['cutoffs'][self.station['id']],'2026-01-10')
        result=compare(self.db,[self.station['id'],'power-presidente'],windows,'daily')
        self.assertEqual(result['series'],[])
        self.assertIsNotNone(result['reason'])

    def test_noaa_uses_source_labels_and_is_idempotent(self):
        rows=[]
        for year in [2023,2024]:
            cells=''.join(f'<td><span class="roni-{phase}">{value}</span></td>' for phase,value in [('normal',1.2),('warm',.7),('warm',.8)]+[('normal',0)]*9)
            rows.append(f'<tr><th scope="row">{year}</th>{cells}</tr>')
        path=Path(self.tmp.name)/'noaa.html';path.write_text('<table>'+''.join(rows)+'</table>')
        r=import_noaa(self.db,path)
        self.assertEqual(r['inserted'],24)
        events=self.db.execute('SELECT * FROM event ORDER BY start').fetchall()
        self.assertEqual(len(events),2)
        self.assertEqual(events[0]['start'],'2023-02-01') # normal value 1.2 is NOT an episode
        self.assertEqual(import_noaa(self.db,path)['duplicates'],24)

    def test_complete_relative_months_do_not_clip_longer_month(self):
        windows=[dict(id='a',label='a',start=date(2023,1,1),end=date(2023,2,28)),
                 dict(id='b',label='b',start=date(2024,3,1),end=date(2024,4,30))]
        result=compare(self.db,[self.station['id']],windows,'monthly')
        self.assertEqual([s['end'] for s in result['series']],['2023-02-28','2024-04-30'])

    def test_foreign_keys_and_backup(self):
        self.load([('2024-01-01',5,'mm')])
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('DELETE FROM source WHERE id="nasa"')
        self.db.rollback()
        target=sqlite3.connect(Path(self.tmp.name)/'backup.sqlite');self.db.backup(target)
        self.assertEqual(target.execute('SELECT value FROM measurement').fetchone()[0],5);target.close()


class ApiTests(unittest.TestCase):
    def test_validation_and_empty_database(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'tests') as temp:
            with patch.dict(os.environ,{'CHUVA_DB':str(Path(temp)/'api.sqlite')}):
                from app.main import app
                from fastapi.testclient import TestClient
                with closing(connect()) as db: initialize(db)
                with TestClient(app) as client:
                    self.assertEqual(client.get('/').status_code,200)
                    self.assertEqual(client.get('/api/catalog').json()['events'],[])
                    self.assertEqual(client.get('/api/series?station=power-ibirama&start=2024-02-02&end=2024-02-01').status_code,422)
                    self.assertEqual(client.get('/api/compare?events=unknown&stations=power-ibirama').status_code,422)
                    s=client.get('/api/series?station=power-ibirama&start=2024-01-01&end=2024-01-02').json()
                    self.assertEqual(s['valid'],0);self.assertIsNone(s['points'][0]['value'])


if __name__=='__main__': unittest.main()
