
# Chuva × Rio

Análise histórica de precipitação, nível dos rios e fenômenos El Niño e La Niña no Alto Vale do Itajaí, Santa Catarina.

**Projeto Integrador II — UDESC CEAVI · Breno Batista Pascoalin e Henrique Knaul.**

## Acesso online

**Sistema publicado no Render:**

https://analise-precipitacao-rios.onrender.com/#overview

O Chuva × Rio permite explorar dados históricos de precipitação, nível dos rios e fenômenos climáticos por meio de dashboards, filtros, gráficos interativos, comparações e relatórios.

A aplicação possui cinco áreas de navegação e utiliza Python, FastAPI, SQLite, HTML, CSS e JavaScript.

O acervo de demonstração contém **47.504 medições de fontes oficiais**: 33.454 registros de precipitação NASA POWER e 14.050 registros de nível da ANA, além de 920 índices RONI e 94 janelas NOAA/CPC. A ampliação preservou as 5.852 observações anteriores por estação e data, com revisão oficial de 572 valores de 2026, cujos originais continuam arquivados.

![Visão geral do Chuva × Rio](docs/screenshots/dashboard-1366.png)

## Funcionalidades

| Área | Funcionalidades |
| --- | --- |
| **Visão Geral** | Indicadores de dados e cobertura, resumo gráfico e acesso às análises. |
| **Explorar histórico** | Séries de chuva e nível, filtros por período, local, fase ENSO e resolução diária ou mensal. |
| **Comparar períodos** | Comparação de até três episódios, anos ou intervalos personalizados, com duração comum opcional. |
| **Relatórios** | Estatísticas consolidadas, gráficos, cobertura, exportação CSV e geração de PDF. |
| **Fontes e método** | Procedência dos dados, metodologia, calendário ENSO, cobertura e histórico de cargas. |

Os gráficos respondem aos filtros e apresentam dados, unidades e cobertura. El Niño aparece em laranja, La Niña em azul e neutralidade em verde; meses sem classificação ficam em cinza.

As variáveis de chuva e nível são apresentadas separadamente, respeitando suas unidades e critérios estatísticos.

## Fontes dos dados

### NASA POWER — Precipitação

A precipitação diária utiliza o parâmetro PRECTOTCORR da NASA POWER, em coordenadas próximas às sedes de Ibirama e Presidente Getúlio.

Os valores são provenientes de um produto climático em grade, não de dois pluviômetros independentes. No acervo entregue, ambos os pontos apresentaram valores diários iguais.

**Cobertura:** 01/01/1981 a 18/10/2026.

[Fonte NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)

### ANA/SNIRH — Nível dos rios

Dados da estação hidrológica 83440000, em Ibirama, no Rio Itajaí do Norte/Hercílio.

São utilizadas médias diárias consistidas, com conversão de centímetros para metros.

**Cobertura:** 01/01/1981 a 31/12/2021, com lacunas.

O referencial altimétrico das cotas não foi informado. Consultas posteriores não forneceram médias diárias consistidas elegíveis no serviço legado utilizado.

[Fonte HidroWeb](https://www.snirh.gov.br/hidroweb/)

### NOAA/CPC — El Niño, La Niña e neutralidade

O calendário climático utiliza a classificação RONI ERSSTv6 da NOAA/CPC, reproduzindo as classificações oficiais das temporadas.

O sistema distingue El Niño, La Niña, neutralidade e meses sem classificação. Não determina episódios a partir de um único valor isolado.

**Cobertura do calendário distribuído:** janeiro de 1950 a agosto de 2026.

[Fonte NOAA/CPC](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/)

Consulte os detalhes de origem, unidades, revisões e auditoria em [data/README.md](data/README.md).

## Metodologia e critérios

- Precipitação mensal: soma dos dias válidos, expressa em mm.
- Nível mensal: média dos dias válidos, expressa em metros.
- Dados ausentes permanecem identificados como lacunas.
- Ausência de medição não é interpretada como valor zero.
- Filtros ENSO excluem dias fora da fase selecionada sem classificá-los como medições ausentes.
- Comparações entre períodos apresentam médias diárias, amostra e cobertura.
- A comparação de períodos de mesma duração não elimina diferenças de sazonalidade.

**Limites de interpretação:** o sistema realiza análises históricas descritivas. Não comprova relações causais entre ENSO, precipitação e nível do rio, não realiza previsões meteorológicas e não emite alertas de desastres.

## Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Backend | Python e FastAPI |
| Banco de dados | SQLite |
| Frontend | HTML, CSS e JavaScript |
| Gráficos | SVG e JavaScript |
| Fontes climáticas | NASA POWER, ANA/SNIRH e NOAA/CPC |
| Versionamento | Git e GitHub |
| Hospedagem | Render |

## Hospedagem online — Render

A aplicação está publicada como Web Service no Render, conectada à branch `main` do GitHub.

**Endereço público:**

https://analise-precipitacao-rios.onrender.com/#overview

### Configuração

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
python run.py --host 0.0.0.0 --port $PORT --no-browser
```

O arquivo `run.py` inicializa o SQLite quando necessário e carrega o snapshot histórico em bancos vazios antes de iniciar o servidor FastAPI.

A aplicação utiliza o plano gratuito do Render. Após períodos de inatividade, o primeiro acesso pode apresentar demora adicional.

O armazenamento local da instância gratuita não é persistente. O acervo histórico pode ser reconstruído a partir do snapshot versionado, mas alterações feitas somente no SQLite do servidor não são preservadas permanentemente.

## Executar em outra máquina

**Requisitos:** Python 3.11 ou superior, com pip.

Clone o repositório na branch `main` ou extraia o pacote de entrega e abra o terminal na pasta que contém `run.py`.

### Windows / PowerShell

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Se `py` não estiver disponível, utilize `python` na criação do ambiente.

Após a instalação, também é possível iniciar o programa com dois cliques em `iniciar.cmd`.

### Linux / macOS

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

### Acesso local

Após iniciar o servidor, abra:

http://127.0.0.1:8000/

Para utilizar outra porta:

```bash
python run.py --port 8001
```

Para não abrir automaticamente o navegador:

```bash
python run.py --no-browser
```

Não abra `static/index.html` diretamente; a interface necessita do servidor FastAPI.

Após instalar as dependências e carregar o snapshot, a consulta histórica local funciona sem internet.

## Banco de dados e atualizações

O banco padrão fica em `data/chuva.sqlite`.

A inicialização preserva bancos existentes e carrega o snapshot `data/demo.json.gz` quando necessário.

Para carregar manualmente a demonstração em banco vazio:

```bash
python -m app.cli demo
```

Para executar uma atualização das fontes disponíveis:

```bash
python -m app.cli refresh
```

A rotina verifica periodicamente a necessidade de atualizar a NOAA e consulta a NASA até o dia anterior, revisitando dados recentes sujeitos a revisão. Também gera um backup local.

A ANA pode ser importada por uma rotina específica, respeitando os critérios de consistência. Os arquivos brutos e os registros de carga permitem auditar a procedência.

Para criar um backup manual:

```bash
python -m app.cli backup --output data/backups/manual.sqlite
```

Para gerar um novo snapshot a partir de um banco auditado:

```bash
python scripts/export_snapshot.py
```

As cargas exigem conexão com a internet quando consultam fontes externas. A consulta histórica da aplicação utiliza os dados armazenados no SQLite.

## Relatórios e exportações

Na área **Relatórios**, selecione local, período, variáveis, fase climática e resolução temporal.

O sistema apresenta estatísticas, cobertura e gráficos referentes ao recorte escolhido.

- **CSV:** exporta a série consultada, preservando lacunas.
- **PDF:** utiliza o recurso de impressão do navegador. Clique em Salvar PDF e selecione Salvar como PDF.

O relatório consolidado contém o recorte analisado, as fontes, estatísticas e gráficos.

## Testes e validação

O projeto possui testes automatizados de consistência dos dados, API, períodos, classificação ENSO, importações e integridade.

Na conferência local de 05/11/2026, os testes Python apresentaram:

**23 testes aprovados, sem falhas.**

Para executar:

```bash
python -m unittest discover -s tests -v
```

Para verificar a sintaxe do JavaScript:

```bash
node --check static/app.js
```

Os testes de navegação utilizam Playwright e Node.js:

```bash
npm install --no-save playwright
npx playwright install chromium firefox
node tests/browser.cjs
```

A documentação de validação apresenta os ensaios de navegação, acessibilidade, exportação e desempenho realizados com o acervo entregue.

[Consultar os resultados de validação](docs/STATUS_MVP.md)

## Demonstração do sistema

O roteiro acadêmico contempla:

1. Apresentação do dashboard e do acervo histórico.
2. Exploração de precipitação e nível dos rios.
3. Seleção de fases El Niño, La Niña e neutralidade.
4. Identificação de lacunas e limites da cobertura.
5. Comparação de episódios e períodos personalizados.
6. Geração de relatórios CSV e PDF.
7. Explicação da origem dos dados e da metodologia.

O ano de 2016 é recomendado para demonstrar as três fases climáticas com séries de precipitação e nível.

Para apresentação online, acesse o site antecipadamente. A execução local pode ser utilizada como alternativa caso a hospedagem gratuita esteja indisponível.

[Consultar roteiro completo](docs/DEMONSTRACAO.md)

## Estrutura do projeto

- `app/` — backend, rotas FastAPI, SQLite e integração de fontes.
- `static/` — interface, estilos e gráficos.
- `data/` — snapshot, dados históricos e arquivos brutos.
- `docs/` — especificação, validação, roteiro e capturas.
- `tests/` — testes automatizados.
- `scripts/` — ferramentas auxiliares.
- `run.py` — inicialização da aplicação.
- `iniciar.cmd` — iniciador para Windows.
- `requirements.txt` — dependências Python.

A documentação interativa da API está disponível localmente em:

http://127.0.0.1:8000/docs

Principais endpoints: `/api/catalog`, `/api/series` e `/api/compare`.

## Documentação acadêmica

- [Especificação revisada — 28/09/2026](docs/Chuva_x_Rio_Especificacao_Revisada_28-09-2026.pdf)
- [Roteiro de demonstração](docs/DEMONSTRACAO.md)
- [Status e validação](docs/STATUS_MVP.md)
- [Documentação dos dados](data/README.md)

---

**Projeto Integrador II — UDESC CEAVI**

**Desenvolvedores:** Breno Batista Pascoalin e Henrique Knaul.

**Sistema online:** https://analise-precipitacao-rios.onrender.com/#overview
