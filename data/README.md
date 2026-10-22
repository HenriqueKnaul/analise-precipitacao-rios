# Base da demonstração — 21/10/2026

`demo.json` é uma exportação dos registros reais carregados, incluindo fonte, coordenadas, datas de coleta, referência HTTP, hash SHA-256 e caminho do artefato bruto. Os arquivos referenciados ficam em `raw/`. Não há medições sintéticas no snapshot. A base contém 5.852 medições: 4.538 de chuva e 1.314 de nível, além de 94 janelas ENSO: 25 de El Niño, 22 de La Niña e 47 neutras / sem episódio confirmado.

## Conteúdo e limites

- NOAA/CPC: tabela RONI **ERSSTv6** consultada em 21/10/2026. O último mês central publicado no arquivo recebido é agosto de 2026. A aplicação importa as classes `roni-warm`, `roni-cold` e `roni-normal` da página, sem classificar os valores por limiar próprio. As três classes geram janelas contíguas; `roni-normal` é representada internamente por `neutral` (sem episódio confirmado). A referência RONI ERSSTv6 usa base 1991–2020 e limiar de ±0,5 °C por pelo menos cinco temporadas sobrepostas. Valores recentes podem ser revisados; meses sem índice permanecem sem classificação. A revisão de 22/10/2026 reutiliza integralmente os 920 índices oficiais já armazenados e todas as medições, sem nova coleta. Datas de eventos são o primeiro e último dia dos **meses centrais** das temporadas, convenção de navegação documentada; não são datas diárias de início físico do fenômeno.
- NASA POWER: PRECTOTCORR, resolução diária, `time-standard=LST`, resposta em mm/day, normalizada para lâmina diária em mm. Pontos aproximados das sedes: Ibirama (-27.057, -49.519) e Presidente Getúlio (-27.051, -49.622). São consultas a produto em grade, não estações pluviométricas. A resposta bruta também conserva geometria e metadados da NASA. Pontos tão próximos podem retornar a mesma célula.
- Intervalos carregados para os dois pontos: 01/01/1997–31/12/1998; 01/11/2014–31/12/2016; 01/01/2023–31/03/2024; 01/01/2026–20/10/2026. No último intervalo, 19 e 20/10 vieram como sentinelas de ausência; último valor válido em **18/10/2026**. Intervalos entre essas janelas não foram carregados.
- ANA/SNIRH: estação **83440000 — Ibirama, Rio Itajaí do Norte/Hercílio**, em Ibirama/SC, coordenadas do inventário -27.0539, -49.5167. Responsável ANA, operadora EPAGRI-SC. O cadastro e as referências estão em [`ibirama-ana.json`](ibirama-ana.json), incluindo arquivo bruto e hash do inventário consultado em 21/10/2026.
- Nível: **1.314 médias diárias reais**, recebidas em centímetros e normalizadas para metros. Apenas consistência 2, `MediaDiaria=1` e status diário 1 são aceitos. Referencial altimétrico não informado: os números são cotas locais, não elevação absoluta.
- Cobertura de nível: 01/01/1997–31/12/1998 contém **522 dias válidos e 208 ausentes**; 01/11/2014–31/12/2016 contém **792 dias válidos**. A consulta 01/07/2023–29/02/2024 não retornou série; nenhum valor foi criado para preencher o intervalo. Não há série atual de nível incluída.

## Regra da importação ANA

O comando `python -m app.cli ana --metadata data/ibirama-ana.json --start 2014-11-01 --end 2016-12-31` consulta o serviço público `HidroSerieHistorica`. O XML recebido é preservado com SHA-256. O adaptador expande os campos diários do mês, aplica as regras de consistência e qualidade e conserva as ausências. O dicionário de dados referenciado no JSON documenta cotas em cm e os indicadores de medição; o nível de consistência segue a enumeração do serviço atual. A aplicação não interpola, não mistura cota com vazão e não cria dados de 2023/2024 ou 2026.

## Rastreabilidade

As cargas repetidas/revisões estão registradas, inclusive uma falha inicial do parser NOAA antes de sua correção. Nenhuma falha apagou uma medição confirmada. A soma de inseridos + atualizados + duplicados + rejeitados corresponde aos registros processados. Motivos das rejeições ficam na mensagem de carga (até 2.000 caracteres); o arquivo completo permanece em `raw/`.

Os dados de teste gerados por `unittest` nunca entram no banco da demonstração. Para recriar o snapshot depois de novas cargas reais: `python scripts/export_snapshot.py`. Reveja conteúdo e arquivos brutos antes de distribuir uma nova versão.

Fontes: [NOAA/CPC RONI](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/), [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), [ANA HidroWeb](https://www.snirh.gov.br/hidroweb/), [inventário ANA](https://www.ana.gov.br/telemetria1ws/ServiceANA.asmx?op=HidroInventario) e [série histórica ANA](https://www.ana.gov.br/telemetria1ws/ServiceANA.asmx?op=HidroSerieHistorica).
