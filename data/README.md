# Base da demonstração — 21/10/2026

`demo.json` é uma exportação dos registros reais carregados, incluindo fonte, coordenadas, datas de coleta, referência HTTP, hash SHA-256 e caminho do artefato bruto. Os arquivos referenciados ficam em `raw/`. Não há medições sintéticas no snapshot.

## Conteúdo e limites

- NOAA/CPC: tabela RONI **ERSSTv6** consultada em 21/10/2026. O último mês central publicado no arquivo recebido é agosto de 2026. A aplicação importa as classes `roni-warm` da página, sem classificar os valores por limiar próprio. Somente essas marcações geram eventos. Datas de eventos são o primeiro e último dia dos **meses centrais** das temporadas, convenção de navegação documentada; não são datas diárias de início físico do fenômeno.
- NASA POWER: PRECTOTCORR, resolução diária, `time-standard=LST`, resposta em mm/day, normalizada para lâmina diária em mm. Pontos aproximados das sedes: Ibirama (-27.057, -49.519) e Presidente Getúlio (-27.051, -49.622). São consultas a produto em grade, não estações pluviométricas. A resposta bruta também conserva geometria e metadados da NASA. Pontos tão próximos podem retornar a mesma célula.
- Intervalos carregados para os dois pontos: 01/01/1997–31/12/1998; 01/11/2014–31/12/2016; 01/01/2023–31/03/2024; 01/01/2026–20/10/2026. No último intervalo, 19 e 20/10 vieram como sentinelas de ausência; último valor válido em **18/10/2026**. Intervalos entre essas janelas não foram carregados.
- ANA: **nenhum arquivo de nível regional foi validado ou incluído**. O gráfico e o importador estão implementados e testados com dados controlados somente nos testes. A interface apresenta indisponibilidade até uma carga real. Não há estação inventada no catálogo.

## Rastreabilidade

As cargas repetidas/revisões estão registradas, inclusive uma falha inicial do parser NOAA antes de sua correção. Nenhuma falha apagou uma medição confirmada. A soma de inseridos + atualizados + duplicados + rejeitados corresponde aos registros processados. Motivos das rejeições ficam na mensagem de carga (até 2.000 caracteres); o arquivo completo permanece em `raw/`.

Os dados de teste gerados por `unittest` nunca entram no banco da demonstração. Para recriar o snapshot depois de novas cargas reais: `python scripts/export_snapshot.py`. Reveja conteúdo e arquivos brutos antes de distribuir uma nova versão.

Fontes: [NOAA/CPC RONI](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/), [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), [ANA HidroWeb](https://www.snirh.gov.br/hidroweb/).
