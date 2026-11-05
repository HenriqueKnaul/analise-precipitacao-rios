"""Export a real, previously ingested database for offline demonstration."""
import gzip
import json
import sys
from contextlib import closing
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from app.db import ROOT, connect, initialize, rebuild_events

with closing(connect()) as db:
    initialize(db)
    rebuild_events(db)
    db.commit()
    snapshot={table:[dict(r) for r in db.execute(f'SELECT * FROM {table}')]
              for table in ('source','station','ingestion','enso_index','event','measurement')}
payload=json.dumps(snapshot,ensure_ascii=False,separators=(',',':')).encode('utf-8')
(ROOT/'data'/'demo.json.gz').write_bytes(gzip.compress(payload,mtime=0))
print('Snapshot:',len(snapshot['measurement']),'medições,',len(snapshot['event']),'episódios.')
