import os
import sqlite3
import calendar
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PHASE_LABELS = {'warm': 'El Niño', 'cold': 'La Niña', 'neutral': 'Neutro / sem episódio confirmado'}


def rebuild_events(db):
    """Derive contiguous phase windows from the source's central-month labels.

    Warm IDs remain stable for older bookmarks. A missing index month always
    breaks a window; it must never be silently classified as neutral.
    """
    db.execute("UPDATE enso_index SET phase='neutral' WHERE phase='normal'")
    rows = db.execute('SELECT * FROM enso_index ORDER BY date').fetchall()
    db.execute('DELETE FROM event')
    groups = []
    for row in rows:
        if row['phase'] not in PHASE_LABELS:
            raise ValueError('Classificação ENSO desconhecida')
        stamp = date.fromisoformat(row['date'])
        ordinal = stamp.year * 12 + stamp.month
        if not groups or groups[-1][-1]['phase'] != row['phase'] or ordinal != previous + 1:
            groups.append([])
        groups[-1].append(row)
        previous = ordinal
    for group in groups:
        first, last = group[0], group[-1]
        phase = first['phase']
        stamp = date.fromisoformat(last['date'])
        end = stamp.replace(day=calendar.monthrange(stamp.year, stamp.month)[1]).isoformat()
        event_id = ('roni-' if phase == 'warm' else f'roni-{phase}-') + first['date']
        label = f"{PHASE_LABELS[phase]} · {first['date'][:7]} → {end[:7]}"
        db.execute('INSERT INTO event(id,start,end,label,run_id,phase) VALUES(?,?,?,?,?,?)',
                   (event_id, first['date'], end, label, last['run_id'], phase))


def connect(path=None):
    path = path or os.environ.get('CHUVA_DB', str(ROOT / 'data' / 'chuva.sqlite'))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def initialize(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS source(id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS station(
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('grid','river')), latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
      longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), datum TEXT,
      UNIQUE(id,source_id));
    CREATE TABLE IF NOT EXISTS ingestion(
      id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), started TEXT NOT NULL,
      finished TEXT, status TEXT NOT NULL, artifact TEXT, sha256 TEXT, reference TEXT,
      inserted INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0,
      duplicates INTEGER NOT NULL DEFAULT 0, rejected INTEGER NOT NULL DEFAULT 0,
      message TEXT, UNIQUE(id,source_id));
    CREATE TABLE IF NOT EXISTS measurement(
      station_id TEXT NOT NULL, source_id TEXT NOT NULL, date TEXT NOT NULL,
      value REAL NOT NULL, original TEXT NOT NULL, original_unit TEXT NOT NULL,
      run_id INTEGER NOT NULL, PRIMARY KEY(station_id,date),
      FOREIGN KEY(station_id,source_id) REFERENCES station(id,source_id),
      FOREIGN KEY(run_id,source_id) REFERENCES ingestion(id,source_id));
    CREATE TABLE IF NOT EXISTS enso_index(
      date TEXT PRIMARY KEY, value REAL NOT NULL, phase TEXT NOT NULL,
      run_id INTEGER NOT NULL REFERENCES ingestion(id));
    CREATE TABLE IF NOT EXISTS event(
      id TEXT PRIMARY KEY, start TEXT NOT NULL, end TEXT NOT NULL,
      label TEXT NOT NULL, run_id INTEGER NOT NULL REFERENCES ingestion(id),
      phase TEXT NOT NULL DEFAULT 'warm' CHECK(phase IN ('warm','cold','neutral')));
    CREATE INDEX IF NOT EXISTS ingestion_source ON ingestion(source_id,started);
    ''')
    # Existing installations contained only warm events. Rebuild once from the
    # already ingested NOAA labels, preserving observations and provenance.
    event_columns = {row['name'] for row in db.execute('PRAGMA table_info(event)')}
    if 'phase' not in event_columns:
        db.execute("ALTER TABLE event ADD COLUMN phase TEXT NOT NULL DEFAULT 'warm'")
        rebuild_events(db)
    elif db.execute("SELECT 1 FROM enso_index WHERE phase='normal' LIMIT 1").fetchone():
        rebuild_events(db)
    db.executemany('INSERT OR IGNORE INTO source VALUES(?,?,?)', [
        ('noaa', 'NOAA/CPC · RONI ERSSTv6', 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/'),
        ('nasa', 'NASA POWER · PRECTOTCORR', 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/'),
        ('ana', 'ANA/SNIRH · Hidro', 'https://www.ana.gov.br/telemetria1ws/ServiceANA.asmx?op=HidroSerieHistorica'),
    ])
    db.execute("UPDATE source SET name='ANA/SNIRH · Hidro',url=? WHERE id='ana'",
               ('https://www.ana.gov.br/telemetria1ws/ServiceANA.asmx?op=HidroSerieHistorica',))
    db.executemany('INSERT OR IGNORE INTO station VALUES(?,?,?,?,?,?,?)', [
        ('power-ibirama','nasa','Ibirama · ponto de consulta','grid',-27.057,-49.519,None),
        ('power-presidente','nasa','Presidente Getúlio · ponto de consulta','grid',-27.051,-49.622,None),
    ])
    db.commit()
