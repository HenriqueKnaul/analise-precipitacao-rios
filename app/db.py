import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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
      label TEXT NOT NULL, run_id INTEGER NOT NULL REFERENCES ingestion(id));
    CREATE INDEX IF NOT EXISTS ingestion_source ON ingestion(source_id,started);
    ''')
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
