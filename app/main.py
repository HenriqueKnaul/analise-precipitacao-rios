from datetime import date
from contextlib import closing
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .db import ROOT, connect, initialize
from .series import series, compare

app = FastAPI(title='Chuva x Rio', version='1.0.0')
with closing(connect()) as db:
    initialize(db)
app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')


@app.get('/')
def home():
    return FileResponse(ROOT/'static'/'index.html')


@app.get('/api/catalog')
def catalog():
    with closing(connect()) as db:
        stations = [dict(r) for r in db.execute('''SELECT s.*,MIN(m.date) first_valid,MAX(m.date) last_valid,
                    COUNT(m.date) samples FROM station s LEFT JOIN measurement m ON m.station_id=s.id GROUP BY s.id''')]
        events = [dict(r) for r in db.execute('SELECT * FROM event ORDER BY start')]
        for e in events:
            e['samples'] = db.execute('SELECT COUNT(*) FROM measurement WHERE date BETWEEN ? AND ?', (e['start'],e['end'])).fetchone()[0]
        return dict(stations=stations,events=events,
                    sources=[dict(r) for r in db.execute('SELECT * FROM source')],
                    indices=[dict(r) for r in db.execute('SELECT * FROM enso_index ORDER BY date')],
                    runs=[dict(r) for r in db.execute('SELECT * FROM ingestion ORDER BY id DESC LIMIT 30')])


@app.get('/api/series')
def get_series(station: str, start: date, end: date, resolution: Literal['daily','monthly']='monthly'):
    validate_range(start,end)
    with closing(connect()) as db:
        try:
            return series(db,station,start,end,resolution)
        except ValueError as e:
            raise HTTPException(422,str(e))


def validate_range(start,end):
    if end<start or (end-start).days>366*5:
        raise HTTPException(422,'Intervalo deve ser crescente e limitado a cinco anos.')


@app.get('/api/compare')
def get_comparison(events: str, stations: str, resolution: Literal['daily','monthly']='monthly',
                   common: bool=True, current_start: date | None=None,
                   current_end: date | None=None):
    current_start = current_start or date(date.today().year,1,1)
    current_end = current_end or date.today()
    event_ids, station_ids = events.split(','), stations.split(',')
    if not 1 <= len(event_ids) <= 3 or len(set(event_ids))!=len(event_ids) or not 1<=len(station_ids)<=2:
        raise HTTPException(422,'Selecione de um a três períodos e até duas variáveis.')
    validate_range(current_start,current_end)
    with closing(connect()) as db:
        if len(set(station_ids)) != len(station_ids) or any(
            not db.execute('SELECT 1 FROM station WHERE id=?',(station,)).fetchone() for station in station_ids
        ):
            raise HTTPException(422,'Estação desconhecida ou repetida.')
        windows = []
        for event_id in event_ids:
            if event_id=='current':
                if current_end > date.today():
                    raise HTTPException(422,'A janela atual não pode incluir datas futuras.')
                windows.append(dict(id='current',start=current_start,end=current_end,label='Período atual',current=True))
            else:
                event = db.execute('SELECT * FROM event WHERE id=?',(event_id,)).fetchone()
                if not event:
                    raise HTTPException(422,'Evento desconhecido')
                windows.append(dict(id=event_id,start=date.fromisoformat(event['start']),end=date.fromisoformat(event['end']),label=event['label']))
        try:
            return compare(db,station_ids,windows,resolution,common)
        except ValueError as e:
            raise HTTPException(422,str(e))
