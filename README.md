# Chuva × Rio

Análise histórica de chuva e nível dos rios no Alto Vale do Itajaí.
Projeto Integrador II — UDESC CEAVI. **Breno Batista Pascoalin e Henrique Knaul.**

MVP para **22/10/2026**: calendário RONI/NOAA, chuva NASA POWER real, comparação de até três períodos, gráficos diário/mensal, origem, cobertura e CSV. **Não há série regional de nível real validada nesta entrega**: o importador e os gráficos estão implementados e testados, com indisponibilidade explícita até receber dados.

## Executar no Windows

Python 3.11+ com pip. Na pasta do projeto, em PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.cli demo
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Abra **http://127.0.0.1:8000** e mantenha o terminal aberto. Ctrl+C encerra.
Não é preciso ativar scripts PowerShell. Se não houver `py`, use `python` no primeiro comando.
A carga `demo` é feita uma vez e recusa bancos com cargas anteriores. Nas próximas execuções, basta iniciar o servidor. Após instalar e carregar, a consulta funciona sem internet.

Linux/macOS:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m app.cli demo
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Nos exemplos seguintes, `python` significa o executável do ambiente virtual.
Banco padrão: `data/chuva.sqlite`. Para outro banco, defina `CHUVA_DB`.
No PowerShell: `$env:CHUVA_DB="data/outro.sqlite"`.
`python -m app.cli init` inicia catálogo vazio, sem o snapshot.

## Demonstração e cobertura

Veja [roteiro de 5–7 minutos](docs/DEMONSTRACAO.md), [base e procedência](data/README.md) e [testes e pendências](docs/STATUS_MVP.md).

Compare 2014–2016 com 2023–2024; troque resolução e ponto municipal; adicione o período atual e exporte CSV. A comparação usa dia/mês relativo, sem controlar sazonalidade. Meses completos mantêm seu número de dias; último mês parcial limita o corte. Não é análise causal ou previsão.

Chuva mensal é soma dos dias válidos; nível mensal é média dos dias válidos. Zero difere de ausência. Curvas não atravessam lacunas e pontos mensais parciais ficam isolados. RONI reproduz marcações da NOAA usando meses centrais das temporadas; não se classificam eventos por limiar próprio. Cotas de estações diferentes não são equiparadas.

## Atualizar dados

```sh
python -m app.cli noaa
python -m app.cli nasa --station power-ibirama --start 2023-01-01 --end 2024-03-31
python -m app.cli nasa --station power-presidente --start 2023-01-01 --end 2024-03-31
python -m app.cli refresh
python -m app.cli backup --output data/backups/manual.sqlite
```

`refresh` atualiza NOAA mensalmente e NASA até ontem, revisitando 30 dias para revisões.
Pode ser chamado pelo Agendador de Tarefas/cron; **nenhum agendamento foi instalado**.
Duas tentativas por requisição; falhas preservam histórico. `refresh` faz backup diário; cargas avulsas devem ser seguidas por `backup`. A interface não consulta APIs externas.

## Importar nível de rio

Obtenha arquivo público ANA/SNIRH e confira estação, unidade, consistência e estatística.
O MVP aceita CSV intermediário UTF-8 com cabeçalho `date,value`, data ISO e **média diária documentada**. Não aceita diretamente todos os layouts HidroWeb nem calcula médias de leituras horárias.
Campos vazios são ausência; datas repetidas no mesmo arquivo provocam rollback.

Prepare também um JSON com:
`code`, `name`, `latitude`, `longitude`, `reference` (HTTPS do arquivo público),
`unit` (`cm` ou `m`), `statistic` (`daily_mean`) e `datum` (texto ou null se desconhecido).
Use código e coordenadas reais. Conserve o arquivo original e descreva a transformação;
campos adicionais no JSON ficam preservados na auditoria.

```sh
python -m app.cli river --file caminho/serie.csv --metadata caminho/estacao.json
```

Recarregue a página para selecionar a estação. Não use amostras dos testes como observações.

## Testes

```sh
python -m unittest discover -s tests -v
node --check static/app.js
```

Testes em bancos temporários: API, calendário, lacunas, unidades, agregação, revisão,
falha de rede, rollback e backup. Teste opcional de navegador (Node 20+):

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser.cjs
```

Use Python do ambiente virtual no PATH ou defina `TEST_PYTHON`.
`TEST_BROWSER` permite indicar Chromium instalado. Carregue `demo` antes.
O teste inicia servidor temporário na porta 8765 e salva capturas em `output/screenshots`.

## Estrutura

- `app/db.py`: SQLite, catálogo, integridade e persistência.
- `app/ingest.py`: adaptadores, normalização, artefatos e auditoria.
- `app/series.py`: cobertura, agregação e alinhamento.
- `app/main.py`: FastAPI de consulta e arquivos estáticos.
- `app/cli.py`: cargas, atualização e backup.
- `static/`: HTML/CSS/JavaScript, SVG local sem CDN.
- `data/demo.json`: snapshot real para demonstração offline.
- `data/raw/`: artefatos originais das cargas.
- `tests/`: dados/API e navegador.

API em `/docs`: `/api/catalog`, `/api/series`, `/api/compare`.
Aplicação local, sem autenticação nem endpoints públicos de escrita.
SQLite simplifica a demonstração; migração PostgreSQL e homologação de produção ficam pendentes.

A [especificação original](docs/Chuva_x_Rio_Especificacao_Revisada_28-09-2026.pdf) foi preservada.
O repositório base (`dbcaba4`) continha apenas README e PDF, sem implementação.
A entrega segue Python/FastAPI propostos no PDF, substituindo a intenção Java do README anterior.
