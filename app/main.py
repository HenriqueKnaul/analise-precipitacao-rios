from datetime import date
import json
from contextlib import closing
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from .db import ROOT, connect, initialize, PHASE_LABELS
from .series import series, compare

app = FastAPI(title='Chuva x Rio', version='1.1.0')
with closing(connect()) as db:
    initialize(db)
@app.get('/static/index.html',include_in_schema=False)
def redirect_legacy_index():
    return RedirectResponse('../',status_code=307)


@app.get('/style.css',include_in_schema=False)
def stylesheet():
    return FileResponse(ROOT/'static'/'style.css',media_type='text/css',headers={'Cache-Control':'no-cache'})


@app.get('/app.js',include_in_schema=False)
def javascript():
    return FileResponse(ROOT/'static'/'app.js',media_type='text/javascript',headers={'Cache-Control':'no-cache'})


app.mount('/static',StaticFiles(directory=ROOT/'static'),name='static')


@app.get('/')
def home():
    return FileResponse(ROOT/'static'/'index.html',headers={'Cache-Control':'no-cache'})


@app.get('/api/catalog')
def catalog():
    with closing(connect()) as db:
        stations = [dict(r) for r in db.execute('''SELECT s.*,MIN(m.date) first_valid,MAX(m.date) last_valid,
                    COUNT(m.date) samples FROM station s LEFT JOIN measurement m ON m.station_id=s.id GROUP BY s.id''')]
        events = [dict(r) for r in db.execute('SELECT * FROM event ORDER BY start')]
        for e in events:
            e['samples'] = db.execute('SELECT COUNT(*) FROM measurement WHERE date BETWEEN ? AND ?', (e['start'],e['end'])).fetchone()[0]
        index_range = db.execute('SELECT MIN(date),MAX(date) FROM enso_index').fetchone()
        metadata = dict(index='RONI',version='ERSSTv6',base_period='1991–2020',
                        first=index_range[0],last=index_range[1],
                        source_url='https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/',
                        criterion='Classes publicadas pela NOAA/CPC: limiar de ±0,5 °C por pelo menos cinco trimestres móveis sobrepostos.',
                        dates='Cada temporada é associada ao seu mês central: DJF a janeiro, JFM a fevereiro, até NDJ a dezembro. Não representa início físico diário.',
                        neutral='Classe roni-normal: sem episódio quente ou frio confirmado na tabela histórica. Pode incluir valores fora do limiar ainda sem persistência.',
                        unknown='Meses sem índice publicado permanecem sem classificação e não entram no filtro neutro.',
                        revision='Valores recentes podem ser revisados pela NOAA por até dois meses.',
                        caveat='Comparações descritivas: cobertura, sazonalidade e outros fatores influenciam as diferenças. Associação não demonstra causalidade.')
        return dict(stations=stations,events=events,
                    phases=[dict(id=p,label=label,events=sum(e['phase']==p for e in events)) for p,label in PHASE_LABELS.items()],
                    enso=metadata,
                    sources=[dict(r) for r in db.execute('SELECT * FROM source')],
                    indices=[dict(r) for r in db.execute('SELECT * FROM enso_index ORDER BY date')],
                    runs=[dict(r) for r in db.execute('SELECT * FROM ingestion ORDER BY id DESC LIMIT 30')])


@app.get('/api/series')
def get_series(station: str, start: date, end: date, resolution: Literal['daily','monthly']='monthly',
               phase: Literal['all','warm','cold','neutral']='all'):
    validate_range(start,end)
    with closing(connect()) as db:
        try:
            return series(db,station,start,end,resolution,phase)
        except ValueError as e:
            raise HTTPException(422,str(e))


def validate_range(start,end):
    if end<start or (end-start).days>366*5:
        raise HTTPException(422,'Intervalo deve ser crescente e limitado a cinco anos.')


@app.get('/api/compare')
def get_comparison(stations: str, events: str | None=None, resolution: Literal['daily','monthly']='monthly',
                   common: bool=True, current_start: date | None=None,
                   current_end: date | None=None, windows: str | None=Query(default=None,max_length=6000),
                   phase: Literal['all','warm','cold','neutral']='all'):
    current_start = current_start or date(date.today().year,1,1)
    current_end = current_end or date.today()
    event_ids, station_ids = events.split(',') if events else [], stations.split(',')
    if (not events and not windows) or (events and windows):
        raise HTTPException(422,'Informe eventos ou janelas personalizadas.')
    if (events and not 1 <= len(event_ids) <= 3) or len(set(event_ids))!=len(event_ids) or not 1<=len(station_ids)<=2:
        raise HTTPException(422,'Selecione de um a três períodos e até duas variáveis.')
    if any(e in ('current','custom') for e in event_ids):
        validate_range(current_start,current_end)
    with closing(connect()) as db:
        if len(set(station_ids)) != len(station_ids) or any(
            not db.execute('SELECT 1 FROM station WHERE id=?',(station,)).fetchone() for station in station_ids
        ):
            raise HTTPException(422,'Estação desconhecida ou repetida.')
        selected_windows = []
        if windows is not None:
            try:
                parsed = json.loads(windows)
                if not isinstance(parsed,list) or not 1 <= len(parsed) <= 3:
                    raise ValueError('Selecione de uma a três janelas.')
                seen = set()
                for item in parsed:
                    if not isinstance(item,dict):
                        raise ValueError('Janela inválida.')
                    window_id, label = item.get('id'), item.get('label')
                    if not isinstance(window_id,str) or not window_id or len(window_id)>100 or window_id in seen:
                        raise ValueError('Identificador de janela inválido ou repetido.')
                    if not isinstance(label,str) or not label.strip() or len(label)>160:
                        raise ValueError('Nome de janela inválido.')
                    start, end = date.fromisoformat(item['start']), date.fromisoformat(item['end'])
                    validate_range(start,end)
                    if end > date.today():
                        raise ValueError('A janela não pode incluir datas futuras.')
                    window_phase = item.get('phase')
                    if window_phase not in (None,'all','warm','cold','neutral'):
                        raise ValueError('Fase da janela inválida.')
                    selected_windows.append(dict(id=window_id,label=label,start=start,end=end,phase=window_phase))
                    seen.add(window_id)
            except (ValueError,TypeError,KeyError) as exc:
                raise HTTPException(422,f'Janelas inválidas: {exc}')
        for event_id in event_ids:
            if event_id in ('current','custom'):
                if current_end > date.today():
                    raise HTTPException(422,'A janela atual não pode incluir datas futuras.')
                selected_windows.append(dict(id=event_id,start=current_start,end=current_end,
                                    label='Período atual' if event_id=='current' else 'Intervalo escolhido',current=event_id=='current'))
            else:
                event = db.execute('SELECT * FROM event WHERE id=?',(event_id,)).fetchone()
                if not event:
                    raise HTTPException(422,'Evento desconhecido')
                selected_windows.append(dict(id=event_id,start=date.fromisoformat(event['start']),end=date.fromisoformat(event['end']),label=event['label'],phase=event['phase']))
        try:
            return compare(db,station_ids,selected_windows,resolution,common,phase)
        except ValueError as e:
            raise HTTPException(422,str(e))
