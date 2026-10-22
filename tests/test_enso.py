"""ENSO regression fixtures are controlled inputs, never observed data."""
import json
import os
import tempfile
import unittest
from contextlib import closing
from datetime import date
from pathlib import Path
from unittest.mock import patch

from app.db import ROOT, connect, initialize, rebuild_events
from app.ingest import import_noaa, run, store
from app.series import series, compare


class EnsoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests')
        self.path = Path(self.temp.name)
        self.raw_root = patch('app.ingest.ROOT', self.path)
        self.raw_root.start()
        self.db = connect(self.path / 'test.sqlite')
        initialize(self.db)
        self.station = self.db.execute("SELECT * FROM station WHERE id='power-ibirama'").fetchone()
        self.run_id = self.db.execute("INSERT INTO ingestion(source_id,started,status) VALUES('noaa','fixture','sucesso')").lastrowid
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.raw_root.stop()
        self.temp.cleanup()

    def indices(self):
        self.db.executemany('INSERT INTO enso_index VALUES(?,?,?,?)', [
            ('2024-01-01', 1, 'warm', self.run_id),
            ('2024-02-01', -.9, 'cold', self.run_id),
            ('2024-03-01', 0, 'neutral', self.run_id)])
        rebuild_events(self.db)
        self.db.commit()

    def measurements(self):
        def consume(raw, run_id, counts):
            for day, value in [('2024-01-01', 30), ('2024-02-01', 0), ('2024-02-02', 10),
                               ('2024-03-01', 8), ('2024-04-01', 7)]:
                store(self.db, self.station, day, value, 'mm', run_id, counts)
        run(self.db, 'nasa', 'controlled fixture, not observed', lambda: b'fixture', consume)

    def test_source_classes_include_cold_neutral_and_repair_duplicate_catalog(self):
        values = [('cold', -.8)]*5 + [('normal', 1.2)] + [('warm', .8)]*6
        cells = ''.join(f'<td><span class="roni-{p}">{v}</span></td>' for p,v in values)
        path = self.path / 'noaa.html'
        path.write_text(f'<table><tr><th scope="row">2024</th>{cells}</tr></table>')
        result = import_noaa(self.db,path)
        self.assertEqual(result['status'],'sucesso')
        events = list(self.db.execute('SELECT * FROM event ORDER BY start'))
        self.assertEqual([r['phase'] for r in events],['cold','neutral','warm'])
        self.assertEqual(events[0]['end'],'2024-05-31')
        self.assertEqual(events[2]['id'],'roni-2024-07-01')
        self.assertEqual(self.db.execute("SELECT phase FROM enso_index WHERE date='2024-06-01'").fetchone()[0],'neutral')
        self.db.execute("DELETE FROM event WHERE phase!='warm'")
        self.db.commit()
        self.assertEqual(import_noaa(self.db,path)['duplicates'],12)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM event').fetchone()[0],3)

    def test_legacy_schema_migrates_without_touching_measurements(self):
        self.indices()
        self.measurements()
        before = list(map(tuple,self.db.execute('SELECT * FROM measurement ORDER BY date')))
        self.db.executescript('''DROP TABLE event;
            CREATE TABLE event(id TEXT PRIMARY KEY,start TEXT,end TEXT,label TEXT,run_id INTEGER);
            UPDATE enso_index SET phase='normal' WHERE phase='neutral';''')
        initialize(self.db)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM event').fetchone()[0],3)
        self.assertEqual({r[0] for r in self.db.execute('SELECT phase FROM event')},{'warm','cold','neutral'})
        self.assertEqual(before,list(map(tuple,self.db.execute('SELECT * FROM measurement ORDER BY date'))))
        first = list(map(tuple,self.db.execute('SELECT * FROM event ORDER BY start')))
        initialize(self.db)
        self.assertEqual(first,list(map(tuple,self.db.execute('SELECT * FROM event ORDER BY start'))))

    def test_missing_index_breaks_event_window(self):
        self.db.executemany('INSERT INTO enso_index VALUES(?,?,?,?)', [
            ('2024-01-01',0,'neutral',self.run_id),('2024-03-01',0,'neutral',self.run_id)])
        rebuild_events(self.db)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM event').fetchone()[0],2)

    def test_phase_filter_keeps_zeros_and_separates_missing_index(self):
        self.indices()
        self.measurements()
        result = series(self.db,self.station['id'],date(2024,1,1),date(2024,4,30),phase='cold')
        self.assertEqual((result['valid'],result['expected'],result['missing']),(2,29,27))
        self.assertEqual((result['excluded'],result['unclassified']),(62,30))
        self.assertEqual([p['value'] for p in result['points']],[None,10,None,None])
        self.assertEqual(result['summary']['mean_daily'],5)
        self.assertEqual(result['summary']['maximum_date'],'2024-02-02')
        self.assertTrue(result['points'][-1]['unclassified'])
        neutral = series(self.db,self.station['id'],date(2024,4,1),date(2024,4,30),phase='neutral')
        self.assertEqual(neutral['valid'],0)
        self.assertEqual(neutral['expected'],0)
        self.assertIsNone(neutral['coverage'])
        self.assertIsNone(neutral['points'][0]['value'])
        daily = series(self.db,self.station['id'],date(2024,2,1),date(2024,2,2),'daily','cold')
        self.assertEqual([p['value'] for p in daily['points']],[0,10])

    def test_current_cutoff_uses_selected_phase(self):
        self.indices()
        self.measurements()
        result = compare(self.db,[self.station['id']],
                         [dict(id='current',label='Atual',start=date(2024,1,1),end=date(2024,4,30),current=True)],
                         'daily',phase='cold')
        self.assertEqual(result['cutoffs'][self.station['id']],'2024-02-02')
        self.assertEqual(result['series'][0]['end'],'2024-02-02')

    def test_snapshot_covers_all_phases_and_has_no_orphaned_runs(self):
        snapshot = json.loads((ROOT/'data'/'demo.json').read_text(encoding='utf-8'))
        self.assertEqual({row['phase'] for row in snapshot['event']},{'warm','cold','neutral'})
        self.assertEqual(len(snapshot['measurement']),5852)
        runs = {row['id'] for row in snapshot['ingestion']}
        self.assertTrue(all(row['run_id'] in runs for row in snapshot['measurement']+snapshot['enso_index']+snapshot['event']))


class EnsoApiTests(unittest.TestCase):
    def test_windows_and_phase_validation(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'tests') as temp:
            with patch.dict(os.environ,{'CHUVA_DB':str(Path(temp)/'api.sqlite')}):
                from app.main import app
                from fastapi.testclient import TestClient
                with closing(connect()) as db:
                    initialize(db)
                with TestClient(app) as client:
                    windows = [dict(id='first',label='1998',start='1998-01-01',end='1998-12-31',phase='cold'),
                               dict(id='second',label='2016',start='2016-01-01',end='2016-12-31')]
                    params = dict(stations='power-ibirama',windows=json.dumps(windows),phase='cold')
                    response = client.get('/api/compare',params=params)
                    self.assertEqual(response.status_code,200,response.text)
                    self.assertEqual(len(response.json()['series']),2)
                    self.assertEqual(response.json()['series'][0]['window_phase'],'cold')
                    for bad in ['{}','[null]','not-json',json.dumps(windows*2)]:
                        self.assertEqual(client.get('/api/compare',params={**params,'windows':bad}).status_code,422)
                    self.assertEqual(client.get('/api/compare',params={**params,'events':'custom'}).status_code,422)
                    self.assertEqual(client.get('/api/series',params=dict(station='power-ibirama',start='2024-01-01',end='2024-12-31',phase='normal')).status_code,422)
                    meta = client.get('/api/catalog').json()['enso']
                    self.assertEqual(meta['base_period'],'1991–2020')


if __name__ == '__main__':
    unittest.main()
