"""Regression fixtures only: no external requests or observed data are created."""
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from app.db import ROOT, connect, initialize
from app.ingest import import_noaa, import_river, run, store
from app.series import series


class IngestionRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests')
        self.root = Path(self.temp.name)
        self.raw_root = patch('app.ingest.ROOT', self.root)
        self.raw_root.start()
        self.db = connect(self.root / 'test.sqlite')
        initialize(self.db)
        self.station = self.db.execute(
            'SELECT * FROM station WHERE id="power-ibirama"'
        ).fetchone()

    def tearDown(self):
        self.db.close()
        self.raw_root.stop()
        self.temp.cleanup()

    def noaa_file(self, years, warm_value=0.7):
        rows = []
        for year in years:
            cells = ''.join(
                f'<td><span class="roni-{phase}">{value}</span></td>'
                for phase, value in [('warm', warm_value)] * 5 + [('normal', 0)] * 7
            )
            rows.append(f'<tr><th scope="row">{year}</th>{cells}</tr>')
        path = self.root / 'controlled-noaa.html'
        path.write_text('<table>' + ''.join(rows) + '</table>', encoding='utf-8')
        return path

    def test_equivalent_dates_have_one_queryable_canonical_key(self):
        def consume(raw, run_id, counts):
            for day in ['20240101', '2024-W01-1', '2024-01-01']:
                store(self.db, self.station, day, 12, 'mm', run_id, counts)
            store(self.db, self.station, '20240230', 5, 'mm', run_id, counts)

        result = run(self.db, 'nasa', 'fixture: not observed', lambda: b'fixture', consume)
        self.assertEqual((result['inserted'], result['duplicates'], result['rejected']), (1, 2, 1))
        self.assertEqual(self.db.execute('SELECT date FROM measurement').fetchone()[0], '2024-01-01')
        queried = series(self.db, self.station['id'], date(2024, 1, 1), date(2024, 1, 1), 'daily')
        self.assertEqual((queried['valid'], queried['points'][0]['value']), (1, 12))

    def test_csv_date_aliases_do_not_bypass_conflict_detection(self):
        path = self.root / 'river.csv'
        path.write_text('date,value\n20240101,100\n2024-01-01,200\n', encoding='utf-8')
        metadata = dict(code='TEST-ONLY', name='Controlled fixture', latitude=0, longitude=0,
                        reference='https://example.org/fixture', unit='cm', statistic='daily_mean')
        result = import_river(self.db, path, metadata)
        self.assertEqual(result['status'], 'falha')
        self.assertIn('Data duplicada', result['message'])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM measurement').fetchone()[0], 0)
        self.assertIsNone(self.db.execute('SELECT 1 FROM station WHERE id="ana-TEST-ONLY"').fetchone())

    def test_truncated_noaa_response_cannot_remove_confirmed_history(self):
        first = import_noaa(self.db, self.noaa_file([2023, 2024]))
        self.assertEqual(first['status'], 'sucesso')
        before_indices = [tuple(r) for r in self.db.execute('SELECT * FROM enso_index ORDER BY date')]
        before_events = [tuple(r) for r in self.db.execute('SELECT * FROM event ORDER BY start')]
        truncated = import_noaa(self.db, self.noaa_file([2024]))
        self.assertEqual(truncated['status'], 'falha')
        self.assertIn('truncada', truncated['message'])
        self.assertEqual(before_indices, [tuple(r) for r in self.db.execute('SELECT * FROM enso_index ORDER BY date')])
        self.assertEqual(before_events, [tuple(r) for r in self.db.execute('SELECT * FROM event ORDER BY start')])

    def test_noaa_revision_and_extension_are_still_allowed(self):
        import_noaa(self.db, self.noaa_file([2023, 2024]))
        revised = import_noaa(self.db, self.noaa_file([2023, 2024, 2025], warm_value=0.9))
        self.assertEqual(revised['status'], 'sucesso')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM enso_index').fetchone()[0], 36)
        self.assertEqual(self.db.execute('SELECT value FROM enso_index WHERE date="2023-01-01"').fetchone()[0], 0.9)


if __name__ == '__main__':
    unittest.main()
