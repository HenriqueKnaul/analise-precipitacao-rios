# Chuva × Rio

Análise histórica de precipitação, nível dos rios e fenômenos El Niño e La Niña no Alto Vale do Itajaí, Santa Catarina.
**Projeto Integrador II — UDESC CEAVI · Breno Batista Pascoalin e Henrique Knaul.**

MVP local com quatro áreas de navegação, filtros de período e fase ENSO, gráficos interativos, comparação e exportação CSV. A base distribuída contém **5.852 medições reais: 4.538 de precipitação NASA POWER e 1.314 de nível da ANA**, além do calendário histórico NOAA/CPC. Não há medições simuladas na demonstração.

![Visão geral do Chuva × Rio](docs/screenshots/dashboard.png)

## Executar em outra máquina

Requisito: **Python 3.11 ou superior**, com pip. Baixe ou clone o repositório e abra o terminal na pasta que contém `run.py`.

**Windows / PowerShell:**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Se `py` não existir, use `python` na primeira linha. Não é necessário ativar scripts do PowerShell. Após instalar as dependências, as próximas aberturas também podem ser feitas com dois cliques em **`iniciar.cmd`**.

**Linux / macOS:**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

O iniciador carrega a demonstração quando o banco está vazio e abre **http://127.0.0.1:8000/**. Mantenha o terminal aberto; `Ctrl+C` encerra. Após a instalação, a consulta funciona sem internet: scripts, estilos e gráficos não dependem de CDN.

Não abra `static/index.html` diretamente: a interface precisa do servidor Python. A abertura como arquivo mostra instruções para iniciar corretamente. O GitHub hospeda o código; esta aplicação Python não é executada pelo GitHub Pages.

Nos exemplos seguintes, `python` representa o executável do ambiente virtual. Use `python run.py --no-browser` para não abrir uma aba automaticamente ou `python run.py --port 8001` se a porta padrão estiver ocupada.

## O que apresentar

| Área | Funcionalidades |
| --- | --- |
| **Visão Geral** | Indicadores de dados e cobertura, resumo gráfico e atalhos para explorar a base. |
| **Explorar histórico** | Escolha primeiro o período e os dados; ponto, estação e resolução ficam em “Local e detalhamento”. Valores, cobertura e máximos observados no intervalo. |
| **Comparar períodos** | Exemplo El Niño × La Niña ou até três períodos personalizados, com um cartão por período, duração comum opcional e lacunas explícitas. |
| **Fontes e método** | Fontes oficiais, calendário ENSO, critérios de agregação, cobertura por estação e histórico de cargas. |

Gráficos respondem às seleções; os valores podem ser consultados nos pontos, nas tabelas e no CSV. Chuva e nível têm painéis e unidades distintos. El Niño aparece em laranja, La Niña em azul e neutralidade em verde; meses sem classificação ficam em cinza. Detalhes de amostra, máximos e procedência podem ser expandidos. Veja o [roteiro de apresentação](docs/DEMONSTRACAO.md) e os [resultados de validação](docs/STATUS_MVP.md).

Para demonstrar **El Niño, La Niña e neutralidade no mesmo ano**, consulte **2016**, que tem precipitação e nível durante todo o ano. **1998** também atravessa as três fases, mas o nível possui lacunas. **2023–2024** mostra chuva real e explicita a indisponibilidade de nível no snapshot.

## Dados reais e critérios

- **NOAA/CPC — RONI ERSSTv6:** classificação oficial com base de referência 1991–2020. A tabela considera ±0,5 °C sustentados por pelo menos cinco temporadas trimestrais sobrepostas. O sistema reproduz as marcações `roni-warm`, `roni-cold` e `roni-normal`; não deduz episódios de um valor isolado. [Fonte NOAA](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/).
- **Neutro / sem episódio confirmado:** corresponde à classe normal da tabela e pode incluir temporadas recentes ainda sem episódio confirmado. Um mês sem índice é **sem classificação**, nunca neutro por suposição. Os períodos usam os meses centrais das temporadas, não datas diárias de início físico do fenômeno.
- **NASA POWER — PRECTOTCORR:** precipitação diária em mm, nas coordenadas de Ibirama e Presidente Getúlio. É um produto em grade, não estação pluviométrica; pontos próximos podem compartilhar a mesma célula. [Documentação NASA](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
- **ANA/SNIRH — estação 83440000, Ibirama, Rio Itajaí do Norte/Hercílio:** médias diárias consistidas, com status real, convertidas de cm para m. Referencial altimétrico desconhecido; são cotas locais, não altitude absoluta. [HidroWeb](https://www.snirh.gov.br/hidroweb/).

O calendário distribuído cobre **janeiro de 1950 a agosto de 2026**. Medições locais cobrem **janelas descontínuas entre 1997 e 2026**, detalhadas em [data/README.md](data/README.md). Última precipitação válida: **18/10/2026**. Não há nível carregado para 2023–2024 nem para 2026. Um calendário extenso não significa cobertura hidrometeorológica contínua.

Chuva mensal é a **soma dos dias válidos**; nível mensal é a **média dos dias válidos**. Um total parcial não representa um mês completo. Os indicadores de comparação entre períodos usam médias diárias (mm/dia para chuva e m para nível), acompanhadas de amostra e cobertura, evitando comparar apenas totais de períodos com tamanhos diferentes.

O filtro ENSO conserva o eixo temporal: dias fora da fase escolhida são excluídos, sem serem contados como medições ausentes. Meses sem classificação são informados separadamente. Lacunas não são interpoladas nem convertidas em zero. A comparação de episódios por mês/dia relativo não controla sazonalidade; trecho comum limita a duração, mas não torna amostras equivalentes. Para múltiplos períodos mensais com trecho comum, inicie as janelas no dia 1; na resolução diária, podem começar em datas quaisquer.

**Limites de interpretação:** os gráficos são descritivos. Não comprovam causalidade, não fazem previsão nem emitem alertas. Máximos são os maiores valores disponíveis no recorte, não limiares de desastre. A base fragmentada não sustenta climatologia local contínua nem anomalias climatológicas robustas.

## Bancos existentes e atualização

Banco padrão: `data/chuva.sqlite`. A inicialização preserva medições e cargas existentes e migra o calendário antigo para contemplar as três classes, usando os índices já armazenados.

Para experimentar o snapshot em banco separado, use um caminho novo no PowerShell:

```powershell
$env:CHUVA_DB="data/apresentacao.sqlite"
.\.venv\Scripts\python.exe run.py
```

`python -m app.cli demo` carrega manualmente o snapshot apenas em banco vazio; `python -m app.cli init` cria catálogo vazio. Não exclua o banco para atualizar a interface.

Atualizações das fontes exigem internet e são explícitas:

```sh
python -m app.cli noaa
python -m app.cli nasa --station power-ibirama --start 2023-01-01 --end 2024-03-31
python -m app.cli nasa --station power-presidente --start 2023-01-01 --end 2024-03-31
python -m app.cli ana --metadata data/ibirama-ana.json --start 2014-11-01 --end 2016-12-31
python -m app.cli backup --output data/backups/manual.sqlite
```

`python -m app.cli refresh` verifica NOAA mensalmente e atualiza NASA até ontem, revisitando 30 dias para revisões; faz backup diário. ANA permanece uma carga explícita. Não há agendamento instalado. Falhas de rede preservam o histórico, e a interface consulta apenas a API local. Arquivos brutos, hashes e registros de carga permitem conferir a procedência.

O importador alternativo `python -m app.cli river --file serie.csv --metadata estacao.json` recebe CSV UTF-8 `date,value`, com datas ISO e médias diárias documentadas. O JSON exige `code`, `name`, `latitude`, `longitude`, `reference` HTTPS, `unit` (`cm`/`m`), `statistic` (`daily_mean`) e `datum` conhecido ou `null`. Não aceita automaticamente todos os formatos HidroWeb nem calcula médias de leituras horárias. Datas duplicadas provocam rollback. Detalhes em [data/README.md](data/README.md).

## Testes

```sh
python -m unittest discover -s tests -v
node --check static/app.js
```

Os testes Python usam bancos temporários para classificação ENSO, migração, filtros, agregações, validação, lacunas, revisão, rollback e integridade. Teste de navegação opcional, com Node 20+:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser.cjs
```

Deixe o Python do ambiente virtual no `PATH` ou defina `TEST_PYTHON` com seu caminho. `TEST_BROWSER` permite usar um executável Chromium/Edge instalado. O teste inicia uma instância temporária com banco descartável, interage com a aplicação e grava capturas em `output/screenshots`. Não modifica o banco da apresentação. Os ensaios realizados estão em [docs/STATUS_MVP.md](docs/STATUS_MVP.md).

## Estrutura

- `app/`: FastAPI, SQLite, consultas e adaptadores NOAA/NASA/ANA.
- `static/`: HTML, CSS, JavaScript e gráficos SVG locais.
- `run.py` e `iniciar.cmd`: inicialização da base e servidor.
- `data/demo.json` e `data/raw/`: snapshot real e arquivos de origem.
- `tests/`: testes de dados, API e navegação.
- `docs/`: especificação preservada, roteiro, validação e capturas.

Documentação interativa da API em **http://127.0.0.1:8000/docs**: `/api/catalog`, `/api/series`, `/api/compare`.

Esta revisão evolui o MVP existente em Python/FastAPI, SQLite e JavaScript, mantendo a execução simples. A [especificação acadêmica](docs/Chuva_x_Rio_Especificacao_Revisada_28-09-2026.pdf) continua como referência; PostgreSQL, hospedagem de produção e validação de representatividade climática permanecem fora desta entrega local.
