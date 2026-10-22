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
from app.ingest import run, store, import_river, import_noaa, import_nasa, import_ana, parse_ana
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
        events=self.db.execute("SELECT * FROM event WHERE phase='warm' ORDER BY start").fetchall()
        self.assertEqual(len(events),2)
        self.assertEqual(events[0]['start'],'2023-02-01') # normal value 1.2 is NOT an episode
        self.assertEqual(import_noaa(self.db,path)['duplicates'],24)

    def test_complete_relative_months_do_not_clip_longer_month(self):
        windows=[dict(id='a',label='a',start=date(2023,1,1),end=date(2023,2,28)),
                 dict(id='b',label='b',start=date(2024,3,1),end=date(2024,4,30))]
        result=compare(self.db,[self.station['id']],windows,'monthly')
        self.assertEqual([s['end'] for s in result['series']],['2023-02-28','2024-04-30'])

    def test_partial_calendar_month_even_with_complete_window(self):
        self.load([('2024-02-01',2,'mm'),('2024-02-02',3,'mm')])
        s=series(self.db,self.station['id'],date(2024,2,1),date(2024,2,2))
        self.assertEqual(s['coverage'],100)
        self.assertTrue(s['points'][0]['partial'])
        self.assertTrue(s['points'][0]['window_partial'])
        self.assertEqual(s['points'][0]['calendar_expected'],29)

    def test_midmonth_comparison_requires_daily_or_original_lengths(self):
        windows=[dict(id='a',label='a',start=date(2024,1,25),end=date(2024,1,27)),
                 dict(id='b',label='b',start=date(2023,1,1),end=date(2023,1,10))]
        with self.assertRaisesRegex(ValueError,'dia 1'):
            compare(self.db,[self.station['id']],windows,'monthly')
        for resolution,common in [('daily',True),('monthly',False)]:
            result=compare(self.db,[self.station['id']],windows,resolution,common)
            self.assertTrue(all(s['expected']>0 for s in result['series']))
        one=compare(self.db,[self.station['id']],windows[:1],'monthly')
        self.assertEqual(one['series'][0]['expected'],3)

    def test_ana_quality_flags_and_cm_conversion(self):
        xml=b'''<root><SerieHistorica><EstacaoCodigo>TEST</EstacaoCodigo><NivelConsistencia>2</NivelConsistencia>
        <MediaDiaria>1</MediaDiaria><TipoMedicaoCotas>1</TipoMedicaoCotas><DataHora>2024-02-01T00:00:00</DataHora>
        <Cota01>100</Cota01><Cota01Status>1</Cota01Status><Cota02>250</Cota02><Cota02Status>2</Cota02Status>
        <Cota03>0</Cota03><Cota03Status>1</Cota03Status></SerieHistorica></root>'''
        start,end=date(2024,2,1),date(2024,2,3)
        self.assertEqual(parse_ana(xml,'TEST',start,end),[('2024-02-01','100'),('2024-02-02',None),('2024-02-03','0')])
        with self.assertRaises(ValueError): parse_ana(xml,'DIFFERENT',start,end)
        with self.assertRaises(ValueError): parse_ana(xml.replace(b'<MediaDiaria>1',b'<MediaDiaria>0'),'TEST',start,end)
        path=Path(self.tmp.name)/'test.xml';path.write_bytes(xml)
        meta=dict(code='TEST',name='TEST ONLY',latitude=0,longitude=0,inventory_reference='https://example.org/test',unit='cm',statistic='daily_mean')
        result=import_ana(self.db,meta,start,end,path)
        self.assertEqual((result['inserted'],result['rejected']),(2,1))
        s=series(self.db,'ana-TEST',start,end,'daily')
        self.assertEqual([p['value'] for p in s['points']],[1,None,0])
        self.assertEqual(import_ana(self.db,meta,start,end,path)['duplicates'],2)
        path.write_bytes(xml.replace(b'</root>',xml[6:]))
        failed=import_ana(self.db,meta,start,end,path)
        # Identical duplicate records are idempotent; conflicting duplicates roll back.
        self.assertEqual(failed['status'],'parcial')
        path.write_bytes(xml.replace(b'</root>',xml[6:].replace(b'<Cota01>100',b'<Cota01>300')))
        self.assertEqual(import_ana(self.db,meta,start,end,path)['status'],'falha')
        self.assertEqual(self.db.execute("SELECT value FROM measurement WHERE station_id='ana-TEST' AND date='2024-02-01'").fetchone()[0],1)

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
                    self.assertIn('text/css',client.get('/style.css').headers['content-type'])
                    self.assertIn('javascript',client.get('/app.js').headers['content-type'])
                    self.assertEqual(client.get('/static/index.html',follow_redirects=False).status_code,307)
                    self.assertEqual(client.get('/api/catalog').json()['events'],[])
                    self.assertEqual(client.get('/api/series?station=power-ibirama&start=2024-02-02&end=2024-02-01').status_code,422)
                    self.assertEqual(client.get('/api/compare?events=unknown&stations=power-ibirama').status_code,422)
                    s=client.get('/api/series?station=power-ibirama&start=2024-01-01&end=2024-01-02').json()
                    self.assertEqual(s['valid'],0);self.assertIsNone(s['points'][0]['value'])
                    custom=client.get('/api/compare',params=dict(events='custom',stations='power-ibirama',current_start='2024-01-25',current_end='2024-01-27')).json()
                    self.assertEqual(custom['series'][0]['expected'],3)


if __name__=='__main__': unittest.main()
