"""Cargas explícitas: artefato bruto, hash, transação e auditoria por lote."""
import calendar
import csv
import hashlib
import io
import json
import math
import re
from datetime import date, datetime, timezone
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from .db import ROOT, rebuild_events

NOAA_URL = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/'


def now():
    return datetime.now(timezone.utc).isoformat()


def fetch(url):
    # Bounded timeout and retries; no network access from the query API.
    for attempt in range(2):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'ChuvaXRio/1.0 academic project'}), timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 1:
                raise


def run(db, source, reference, acquire, consume):
    # BEGIN IMMEDIATE serializes collectors; readers keep the committed snapshot.
    db.execute('BEGIN IMMEDIATE')
    run_id = db.execute('INSERT INTO ingestion(source_id,started,status,reference) VALUES(?,?,?,?)',
                        (source, now(), 'executando', reference)).lastrowid
    counts = dict(inserted=0, updated=0, duplicates=0, rejected=0)
    artifact = digest = None
    try:
        raw = acquire()
        digest = hashlib.sha256(raw).hexdigest()
        artifact = f'data/raw/{source}-{digest}.raw'
        (ROOT / artifact).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / artifact).write_bytes(raw)
        db.execute('SAVEPOINT batch')
        consume(raw, run_id, counts)
        db.execute('RELEASE batch')
        status = 'parcial' if counts['rejected'] else 'sucesso'
        message = db.execute('SELECT message FROM ingestion WHERE id=?',(run_id,)).fetchone()[0]
    except Exception as exc:
        # Revert all mutations of this batch, retaining the failure record.
        try:
            db.execute('ROLLBACK TO batch')
            db.execute('RELEASE batch')
        except Exception:
            pass
        counts = dict.fromkeys(counts, 0)
        status, message = 'falha', f'{type(exc).__name__}: {exc}'[:500]
    db.execute('''UPDATE ingestion SET finished=?,status=?,artifact=?,sha256=?,inserted=?,updated=?,
                  duplicates=?,rejected=?,message=? WHERE id=?''',
               (now(), status, artifact, digest, *counts.values(), message, run_id))
    db.commit()
    return dict(db.execute('SELECT * FROM ingestion WHERE id=?', (run_id,)).fetchone())


def store(db, station, day, value, unit, run_id, counts):
    try:
        # Python also accepts basic and ISO-week date forms. Persist one canonical
        # civil-date key so aliases cannot escape range queries or uniqueness.
        day = date.fromisoformat(day).isoformat()
        value_number = float(str(value).replace(',', '.'))
        expected = ('mm','mm/day') if station['kind'] == 'grid' else ('m', 'cm')
        if unit not in expected or not math.isfinite(value_number) or value_number == -999:
            raise ValueError('valor ausente ou unidade inválida')
        if station['kind'] == 'grid' and value_number < 0:
            raise ValueError('chuva negativa')
        normalized = value_number / 100 if unit == 'cm' else value_number
    except (TypeError, ValueError) as exc:
        counts['rejected'] += 1
        db.execute('UPDATE ingestion SET message=substr(COALESCE(message,\'\') || ?,1,2000) WHERE id=?',
                   (f'{day}: {value!r} {unit}: {exc}; ',run_id))
        return
    old = db.execute('SELECT value,original_unit FROM measurement WHERE station_id=? AND date=?', (station['id'],day)).fetchone()
    if old and old['value'] == normalized and old['original_unit'] == unit:
        counts['duplicates'] += 1
        return
    db.execute('''INSERT INTO measurement VALUES(?,?,?,?,?,?,?) ON CONFLICT(station_id,date) DO UPDATE SET
                  value=excluded.value,original=excluded.original,original_unit=excluded.original_unit,run_id=excluded.run_id''',
               (station['id'], station['source_id'],day,normalized,str(value),unit,run_id))
    counts['updated' if old else 'inserted'] += 1


def import_noaa(db, path=None):
    def consume(raw, run_id, counts):
        soup = BeautifulSoup(raw, 'html.parser')
        rows = []
        for tr in soup.select('tr'):
            header = tr.find('th', scope='row', recursive=False)
            if not header or not re.fullmatch(r'\d{4}', header.get_text(strip=True)):
                continue
            year = int(header.get_text(strip=True))
            for month, td in enumerate(tr.find_all('td', recursive=False), 1):
                span = td.select_one('span.roni-warm,span.roni-cold,span.roni-normal')
                if not span:
                    raise ValueError('Formato NOAA mudou: classificação ausente')
                phase = next(p for p in ('warm','cold','normal') if f'roni-{p}' in span['class'])
                value = float(span.get_text())
                if not math.isfinite(value):
                    raise ValueError('Índice NOAA inválido')
                rows.append((date(year,month,1).isoformat(),value,'neutral' if phase == 'normal' else phase))
        if len(rows) < 12 or len({r[0] for r in rows}) != len(rows):
            raise ValueError('Tabela RONI incompleta ou duplicada')
        previous_rows = {r['date']:(r['value'],r['phase']) for r in db.execute('SELECT * FROM enso_index')}
        incoming_dates = {day for day, _, _ in rows}
        missing_dates = previous_rows.keys() - incoming_dates
        if missing_dates:
            raise ValueError(
                f'Tabela RONI truncada: {len(missing_dates)} temporadas já armazenadas ausentes; histórico preservado'
            )
        if previous_rows == {d:(v,p) for d,v,p in rows}:
            # Repair old warm-only event catalogs even when the source is unchanged.
            rebuild_events(db)
            counts['duplicates'] = len(rows)
            return
        # Import the source's own labels; never infer episodes from numeric thresholds.
        db.execute('DELETE FROM event')
        db.execute('DELETE FROM enso_index')
        for day, value, phase in sorted(rows):
            db.execute('INSERT INTO enso_index VALUES(?,?,?,?)',(day,value,phase,run_id))
            counts['updated' if day in previous_rows else 'inserted'] += 1
        rebuild_events(db)
    return run(db,'noaa',NOAA_URL,lambda: path.read_bytes() if path else fetch(NOAA_URL),consume)


def import_nasa(db, station_id, start, end):
    station = db.execute('SELECT * FROM station WHERE id=? AND kind="grid"',(station_id,)).fetchone()
    if not station:
        raise ValueError('Ponto de grade não cadastrado')
    url = ('https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG'
           f'&longitude={station["longitude"]}&latitude={station["latitude"]}&start={start:%Y%m%d}&end={end:%Y%m%d}&format=JSON&time-standard=LST')
    def consume(raw, run_id, counts):
        payload = json.loads(raw)
        unit = payload['parameters']['PRECTOTCORR']['units']
        if unit != 'mm/day':
            raise ValueError('Unidade NASA não reconhecida: '+unit)
        for key, value in payload['properties']['parameter']['PRECTOTCORR'].items():
            day = datetime.strptime(key,'%Y%m%d').date()
            if not start <= day <= end:
                raise ValueError('Data fora da solicitação')
            # mm/day over the source's one-day period => daily depth in mm.
            store(db,station,day.isoformat(),value,'mm/day',run_id,counts)
    return run(db,'nasa',url,lambda: fetch(url),consume)


def import_river(db, path, metadata):
    required = ('code','name','latitude','longitude','reference','unit','statistic')
    if any(k not in metadata for k in required) or metadata['unit'] not in ('cm','m'):
        raise ValueError('Metadados obrigatórios ausentes ou unidade inválida')
    if metadata['statistic'] != 'daily_mean':
        raise ValueError('MVP aceita apenas nível médio diário documentado')
    if not metadata['reference'].startswith('https://'):
        raise ValueError('Informe a referência HTTPS do arquivo público')
    station_id = 'ana-'+str(metadata['code'])
    def consume(raw, run_id, counts):
        values = (station_id,'ana',metadata['name'],'river',metadata['latitude'],metadata['longitude'],metadata.get('datum'))
        old = db.execute('SELECT * FROM station WHERE id=?',(station_id,)).fetchone()
        if old and tuple(old) != values:
            raise ValueError('Metadados diferem do cadastro; revise antes de misturar séries')
        db.execute('INSERT OR IGNORE INTO station VALUES(?,?,?,?,?,?,?)',values)
        station = db.execute('SELECT * FROM station WHERE id=?',(station_id,)).fetchone()
        reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
        if reader.fieldnames != ['date','value']:
            raise ValueError('CSV normalizado deve ter cabeçalho date,value')
        seen = set()
        for row in reader:
            try:
                day = date.fromisoformat(row['date']).isoformat()
            except (TypeError, ValueError):
                day = row['date']  # store records the invalid date as rejected.
            if day in seen:
                raise ValueError('Data duplicada no arquivo; resolva a consistência na origem')
            seen.add(day)
            store(db,station,day,row['value'],metadata['unit'],run_id,counts)
    return run(db,'ana',json.dumps(metadata,ensure_ascii=False),path.read_bytes,consume)


def parse_ana(raw, code, start, end):
    """Read only documented daily means, consistent and real (status 1).

    No estimated/questionable/absent values are silently included. The original
    XML remains the authoritative record of all flags and rejected values.
    """
    root = ET.fromstring(raw)
    rows = []
    for element in root.iter():
        if element.tag.split('}')[-1] != 'SerieHistorica':
            continue
        row = {child.tag.split('}')[-1]: child.text for child in element}
        if row.get('EstacaoCodigo') != str(code) or row.get('NivelConsistencia') != '2':
            raise ValueError('Estação ou nível de consistência diferente do solicitado')
        if row.get('MediaDiaria') != '1' or row.get('TipoMedicaoCotas') != '1':
            raise ValueError('Série não identificada como média diária de cotas')
        month = date.fromisoformat(row['DataHora'][:10]).replace(day=1)
        for day in range(1,calendar.monthrange(month.year,month.month)[1]+1):
            stamp = month.replace(day=day)
            if start <= stamp <= end:
                key = f'Cota{day:02}'
                value = row.get(key) if row.get(key+'Status') == '1' else None
                rows.append((stamp.isoformat(),value))
    if not rows:
        raise ValueError('ANA não retornou médias diárias consistidas neste intervalo')
    return rows


def import_ana(db, metadata, start, end, path=None):
    required=('code','name','latitude','longitude','inventory_reference','unit','statistic')
    if any(key not in metadata for key in required) or metadata['unit']!='cm' or metadata['statistic']!='daily_mean':
        raise ValueError('Metadados ANA incompletos; informe média diária em cm e referência do inventário')
    params=dict(codEstacao=str(metadata['code']),dataInicio=start.strftime('%d/%m/%Y'),
                dataFim=end.strftime('%d/%m/%Y'),tipoDados='1',nivelConsistencia='2')
    url='https://www.ana.gov.br/telemetria1ws/ServiceANA.asmx/HidroSerieHistorica?'+urlencode(params)
    reference=dict(metadata,request_url=url,adapter='ana-xml-v1',rule='CotaNN: MediaDiaria=1, TipoMedicaoCotas=1, NivelConsistencia=2, status=1; cm/100 -> m')
    def consume(raw,run_id,counts):
        rows=parse_ana(raw,metadata['code'],start,end)
        values=('ana-'+str(metadata['code']),'ana',metadata['name'],'river',metadata['latitude'],metadata['longitude'],metadata.get('datum'))
        old=db.execute('SELECT * FROM station WHERE id=?',(values[0],)).fetchone()
        if old and tuple(old)!=values:
            raise ValueError('Metadados diferentes do cadastro existente')
        db.execute('INSERT OR IGNORE INTO station VALUES(?,?,?,?,?,?,?)',values)
        station=db.execute('SELECT * FROM station WHERE id=?',(values[0],)).fetchone()
        seen={}
        for day,value in rows:
            if day in seen and seen[day]!=value:
                raise ValueError('Valores conflitantes no XML para a mesma data')
            seen[day]=value
            store(db,station,day,value,'cm',run_id,counts)
    return run(db,'ana',json.dumps(reference,ensure_ascii=False),path.read_bytes if path else lambda:fetch(url),consume)
