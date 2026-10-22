import calendar
from datetime import date, timedelta


def series(db, station_id, start, end, resolution='monthly', phase='all'):
    if end < start or resolution not in ('daily', 'monthly') or phase not in ('all', 'warm', 'cold', 'neutral'):
        raise ValueError('Intervalo, resolução ou fase inválidos')
    station = db.execute('''SELECT station.*,source.name source_name,source.url source_url
                            FROM station JOIN source ON source.id=station.source_id WHERE station.id=?''',(station_id,)).fetchone()
    if not station:
        raise ValueError('Estação/ponto não encontrado')
    rows = db.execute('''SELECT m.*,i.finished collected_at FROM measurement m JOIN ingestion i ON i.id=m.run_id
                        WHERE station_id=? AND date BETWEEN ? AND ? ORDER BY date''',
                      (station_id,start.isoformat(),end.isoformat())).fetchall()
    indices = {r['date'][:7]: dict(r) for r in db.execute(
        'SELECT date,value,phase FROM enso_index WHERE date BETWEEN ? AND ?',
        (start.replace(day=1).isoformat(), end.isoformat()))}
    def phase_at(day):
        return indices.get(day[:7], {}).get('phase')
    selected = [r for r in rows if phase == 'all' or phase_at(r['date']) == phase]
    values = {r['date']: r['value'] for r in selected}
    points = []
    cursor = start
    expected = excluded = unclassified = 0
    while cursor <= end:
        stop = cursor if resolution == 'daily' else min(end, cursor.replace(day=calendar.monthrange(cursor.year,cursor.month)[1]))
        days = (stop-cursor).days+1
        index = indices.get(cursor.isoformat()[:7])
        point_phase = index['phase'] if index else None
        eligible = phase == 'all' or point_phase == phase
        expected += days if eligible else 0
        excluded += days if not eligible and point_phase is not None else 0
        unclassified += days if point_phase is None else 0
        samples = [values[(cursor+timedelta(days=i)).isoformat()] for i in range(days)
                   if (cursor+timedelta(days=i)).isoformat() in values]
        value = None
        if samples:
            value = sum(samples) if station['kind']=='grid' else sum(samples)/len(samples)
        calendar_days = calendar.monthrange(cursor.year,cursor.month)[1]
        window_partial = resolution=='monthly' and (cursor.day!=1 or stop.day!=calendar_days)
        points.append(dict(date=cursor.isoformat(),end=stop.isoformat(),value=round(value,4) if value is not None else None,
                           valid=len(samples),expected=days if eligible else 0,calendar_expected=calendar_days if resolution=='monthly' else 1,
                           window_partial=window_partial,partial=eligible and (window_partial or 0<len(samples)<days),
                           phase=point_phase,enso_value=index['value'] if index else None,
                           excluded=not eligible,unclassified=point_phase is None))
        cursor = stop+timedelta(days=1)
    maximum = max(selected, key=lambda r: r['value']) if selected else None
    daily_mean = sum(r['value'] for r in selected)/len(selected) if selected else None
    summary = dict(mean_daily=round(daily_mean,4) if daily_mean is not None else None,
                   mean_unit='mm/dia' if station['kind']=='grid' else 'm',
                   total=round(sum(r['value'] for r in selected),4) if selected and station['kind']=='grid' else None,
                   maximum=maximum['value'] if maximum else None,
                   maximum_date=maximum['date'] if maximum else None)
    if selected:
        reason = None
    elif not expected and phase != 'all':
        reason = 'Nenhum dia com classificação da fase selecionada neste intervalo. Meses sem índice não são considerados neutros.'
    else:
        reason = 'Nenhuma medição disponível nos dias elegíveis deste intervalo.'
    return dict(station=dict(station), unit='mm' if station['kind']=='grid' else 'm',
                statistic='soma' if station['kind']=='grid' else 'média',start=start.isoformat(),end=end.isoformat(),
                last_valid=selected[-1]['date'] if selected else None,
                collected_at=max((r['collected_at'] for r in selected),default=None),
                valid=len(selected),expected=expected,missing=expected-len(selected),
                coverage=round(len(selected)/expected*100,1) if expected else None,points=points,
                phase=phase,excluded=excluded,unclassified=unclassified,total_days=(end-start).days+1,
                summary=summary,reason=reason)


def compare(db, station_ids, windows, resolution, common=True, phase='all'):
    if resolution=='monthly' and common and len(windows)>1 and any(w['start'].day!=1 for w in windows):
        raise ValueError('Para comparar meses com trecho comum, inicie os períodos no dia 1. Use resolução diária ou desative o trecho comum para outras datas.')
    # A current window is clipped to the common last observation across variables.
    adjusted = []
    cutoffs = {}
    unavailable = False
    for window in windows:
        w = dict(window)
        if w.get('current'):
            ends = []
            for station in station_ids:
                last = db.execute('''SELECT MAX(m.date) FROM measurement m
                                  LEFT JOIN enso_index e ON e.date=substr(m.date,1,7)||'-01'
                                  WHERE m.station_id=? AND m.date BETWEEN ? AND ?
                                  AND (?='all' OR e.phase=?)''',
                                  (station,w['start'].isoformat(),w['end'].isoformat(),phase,phase)).fetchone()[0]
                cutoffs[station] = last
                if last:
                    ends.append(date.fromisoformat(last))
                else:
                    unavailable = True
            if len(ends)==len(station_ids):
                w['end'] = min(ends)
        adjusted.append(w)
    # A joint current comparison without either variable has no valid common cutoff.
    if unavailable:
        return dict(series=[],cutoffs=cutoffs,common_length=0,
                    reason='Sem cobertura atual para todas as variáveis selecionadas. Consulte uma variável disponível separadamente.')
    lengths = [(w['end']-w['start']).days+1 for w in adjusted]
    if common and len(adjusted)>1:
        if resolution=='daily':
            length = min(lengths)
            for w in adjusted:
                w['end'] = w['start']+timedelta(days=length-1)
        else:
            months = [(w['end'].year-w['start'].year)*12+w['end'].month-w['start'].month+1 for w in adjusted]
            length = min(months)
            # Keep the same day-of-month cutoff for partial final months.
            partial_ends = [w['end'].day for w,m in zip(adjusted,months) if m==length
                            and w['end'].day < calendar.monthrange(w['end'].year,w['end'].month)[1]]
            day_cap = min(partial_ends,default=31)
            for w in adjusted:
                ordinal = w['start'].year*12+w['start'].month-1+length-1
                year, month = ordinal//12, ordinal%12+1
                w['end'] = date(year,month,min(day_cap,calendar.monthrange(year,month)[1]))
    else:
        length = None
    output = []
    for station in station_ids:
        for w in adjusted:
            result = series(db,station,w['start'],w['end'],resolution,phase)
            result.update(label=w['label'],window_id=w['id'],window_phase=w.get('phase'))
            output.append(result)
    return dict(series=output,cutoffs=cutoffs,common_length=length,original_days=lengths,reason=None)
