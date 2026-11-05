# Acervo de demonstração — 05/11/2026

O snapshot `demo.json.gz` contém **47.504 medições de fontes oficiais**. As **5.852 medições anteriores** foram verificadas uma a uma por estação e data. Todos os pares de estação e data foram preservados. Permaneceram idênticas 5.280 linhas. A revisão oficial atualizou 572 valores de 2026, com os originais preservados nos arquivos brutos.

| Fonte e série | Cobertura no acervo | Registros |
| --- | --- | ---: |
| NASA POWER · Ibirama | 01/01/1981 a 18/10/2026, diária contínua | 16.727 |
| NASA POWER · Presidente Getúlio | 01/01/1981 a 18/10/2026, diária contínua | 16.727 |
| ANA/SNIRH · 83440000, Ibirama | 01/01/1981 a 31/12/2021, com lacunas | 14.050 |
| NOAA/CPC · RONI ERSSTv6 | jan/1950 a ago/2026, mês central | 920 índices e 94 janelas |

## Critérios e limitações

- **NASA POWER.** PRECTOTCORR diário, `time-standard=LST`. A taxa diária em mm/day é convertida em lâmina de precipitação daquele dia em mm. Coordenadas aproximadas das sedes de Ibirama (-27.057, -49.519) e Presidente Getúlio (-27.051, -49.622). Os dois pontos retornaram valores idênticos em todo o acervo, compatíveis com a resolução da grade. São estimativas de um produto em grade e não representam dois pluviômetros independentes. Os valores de 19 e 20/10/2026 eram sentinelas de ausência e foram rejeitados na carga original. [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
- **ANA/SNIRH.** Estação 83440000 em Ibirama, Rio Itajaí do Norte/Hercílio (-27.0539, -49.5167). Responsável ANA, operadora EPAGRI-SC. O XML foi consultado no serviço legado. Só entram médias diárias de escala com consistência 2, `MediaDiaria=1`, `TipoMedicaoCotas=1` e status diário 1. As cotas em cm são convertidas para m. O referencial altimétrico não foi informado. As consultas de 2022–2023 e 2024–2026 não forneceram cotas elegíveis nesse serviço. O acesso autenticado à API nova continua pendente. [HidroWeb](https://www.snirh.gov.br/hidroweb/) · [Serviço legado e migração](https://www.ana.gov.br/telemetria1ws/Dados.aspx) · [Cadastro e referências](ibirama-ana.json).
- **NOAA/CPC.** A tabela consultada em 21/10/2026 tem 25 episódios quentes, 22 frios e 47 janelas neutras. A classificação vem das marcas oficiais da tabela e usa a base 1991–2020. Neutro significa sem episódio quente ou frio confirmado. Um mês sem índice fica sem classificação. As datas representam meses centrais das temporadas móveis e os valores recentes são sujeitos a revisão. [NOAA/CPC RONI](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/).

A expansão consultou janelas complementares em 05/11/2026 e acrescentou **28.916 registros NASA** e **12.736 ANA**. A série de nível tem lacunas também entre 1981 e 2021. Exemplo: 1998 tem 188 dias válidos. As lacunas ficam em branco e um zero de chuva informado pela fonte permanece observação válida.

## Revisão oficial da precipitação de 2026

A resposta original da NASA POWER v2.10.0 somava 28.296,48 mm por ponto entre 01/01 e 18/10/2026. A consulta de 05/11/2026 aos mesmos pontos e datas, com a v2.10.2, retornou 1.179,02 mm por ponto. Foram revisados 286 de 291 dias em cada ponto. O aplicativo usa os novos valores publicados pela fonte, sem ajuste por fator próprio. Os lotes originais 16 e 19 e os revisados 53 e 54 conservam as respostas completas e seus hashes. A verificação reproduziu a assinatura das 5.852 linhas anteriores a partir dos registros preservados e dos arquivos originais.

## Auditoria e reprodução

Cada registro tem data civil, estação, fonte e referência à carga que o produziu. A carga conserva a data de coleta, parâmetros da consulta, status, contadores e SHA-256 do arquivo em `raw/`. A falha de cota em 2024–2026 aparece no histórico de cargas. Arquivos rejeitados ficam disponíveis para auditoria. A rotina de consulta usa somente SQLite.

Para carregar a base em um banco novo, use `python -m app.cli demo`. Para recriar o snapshot a partir do banco selecionado em `CHUVA_DB`, use `python scripts/export_snapshot.py` após auditar as cargas e os artefatos. Consulte [validação](../docs/STATUS_MVP.md) e o [README](../README.md).
