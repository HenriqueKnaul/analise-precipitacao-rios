"""Export a real, previously ingested database for offline demonstration."""
import json
import sys
from contextlib import closing
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from app.db import ROOT, connect

with closing(connect()) as db:
    snapshot={table:[dict(r) for r in db.execute(f'SELECT * FROM {table}')]
              for table in ('source','station','ingestion','enso_index','event','measurement')}
(ROOT/'data'/'demo.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Snapshot:',len(snapshot['measurement']),'medições,',len(snapshot['event']),'episódios.')
