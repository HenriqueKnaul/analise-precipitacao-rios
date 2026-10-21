import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from datetime import date, timedelta
from .db import connect, initialize, ROOT
from .ingest import import_noaa, import_nasa, import_river, import_ana


def main():
    parser = argparse.ArgumentParser(description='Cargas e manutenção do Chuva x Rio')
    sub = parser.add_subparsers(dest='command',required=True)
    sub.add_parser('init')
    sub.add_parser('demo')
    n = sub.add_parser('noaa'); n.add_argument('--file',type=Path)
    p = sub.add_parser('nasa'); p.add_argument('--station',required=True)
    p.add_argument('--start',type=date.fromisoformat,required=True); p.add_argument('--end',type=date.fromisoformat,required=True)
    r = sub.add_parser('river'); r.add_argument('--file',type=Path,required=True); r.add_argument('--metadata',type=Path,required=True)
    a = sub.add_parser('ana'); a.add_argument('--file',type=Path); a.add_argument('--metadata',type=Path,required=True)
    a.add_argument('--start',type=date.fromisoformat,required=True); a.add_argument('--end',type=date.fromisoformat,required=True)
    b = sub.add_parser('backup'); b.add_argument('--output',type=Path,required=True)
    sub.add_parser('refresh')
    args = parser.parse_args()
    with closing(connect()) as db:
        initialize(db)
        results=[]
        if args.command=='demo':
            if db.execute('SELECT COUNT(*) FROM ingestion').fetchone()[0]:
                parser.error('Banco já contém cargas. Use um CHUVA_DB novo para carregar o snapshot.')
            snapshot=json.loads((ROOT/'data'/'demo.json').read_text(encoding='utf-8'))
            with db:
                for table in ('source','station','ingestion','enso_index','event','measurement'):
                    for row in snapshot[table]:
                        placeholders=','.join('?' for _ in row)
                        columns=','.join(row)
                        db.execute(f'INSERT OR REPLACE INTO {table} ({columns}) VALUES ({placeholders})',list(row.values()))
            print('Snapshot real carregado. Consulte data/README.md para cobertura e limitações.')
        elif args.command=='noaa': results.append(import_noaa(db,args.file))
        elif args.command=='nasa':
            if args.end<args.start or (args.end-args.start).days>366*5:
                parser.error('Use intervalo crescente de até cinco anos')
            results.append(import_nasa(db,args.station,args.start,args.end))
        elif args.command=='river': results.append(import_river(db,args.file,json.loads(args.metadata.read_text(encoding='utf-8'))))
        elif args.command=='ana':
            if args.end<args.start or (args.end-args.start).days>366*5:
                parser.error('Use intervalo crescente de até cinco anos')
            results.append(import_ana(db,json.loads(args.metadata.read_text(encoding='utf-8')),args.start,args.end,args.file))
        elif args.command=='backup':
            args.output.parent.mkdir(parents=True,exist_ok=True)
            with sqlite3.connect(args.output) as target: db.backup(target)
            print('Backup concluído:',args.output)
        elif args.command=='refresh':
            today=date.today()
            last=db.execute('SELECT MAX(finished) FROM ingestion WHERE source_id="noaa" AND status="sucesso"').fetchone()[0]
            if not last or last[:7]!=today.isoformat()[:7]: results.append(import_noaa(db))
            for s in db.execute('SELECT id FROM station WHERE kind="grid"').fetchall():
                last=db.execute('SELECT MAX(date) FROM measurement WHERE station_id=?',(s['id'],)).fetchone()[0]
                start=max(date(today.year,1,1),date.fromisoformat(last)-timedelta(days=30)) if last else date(today.year,1,1)
                results.append(import_nasa(db,s['id'],start,today-timedelta(days=1)))
            backup=ROOT/'data'/'backups'/f'{today}.sqlite'
            backup.parent.mkdir(parents=True,exist_ok=True)
            with sqlite3.connect(backup) as target: db.backup(target)
        print(json.dumps(results,ensure_ascii=False,indent=2))
        if any(r['status']=='falha' for r in results): raise SystemExit(1)


if __name__=='__main__': main()
