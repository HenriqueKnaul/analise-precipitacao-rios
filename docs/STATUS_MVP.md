# Validação da entrega local — 05/11/2026

Ambiente de teste: Linux x86_64, Python 3.12.14, FastAPI 0.115.12 e SQLite. A referência é a [especificação de 28/09](Chuva_x_Rio_Especificacao_Revisada_28-09-2026.pdf), com o recorte desta entrega para apresentação local.

## Requisitos e evidências

| Requisitos | Entrega e verificação |
| --- | --- |
| RF01–RF05, RF16–RF18 | NASA POWER, NOAA/CPC e ANA integrados por cargas auditáveis. SQLite contém 47.504 medições, com local, fonte, data, unidade e procedência. Cobertura e lacunas aparecem na API, nos gráficos, nas tabelas e nos relatórios. |
| RF06–RF09 | Linha do tempo RONI em ordem cronológica, filtrável por fase, com atalho para o recorte histórico. Chuva e nível em gráficos separados com resolução diária ou mensal. |
| RF10–RF14 | Até três períodos em anos, episódios, datas livres ou período atual. Séries sobrepostas por variável, opções de duração comum ou original. O período atual usa a última data comum com dados. A interface informa quando uma variável carece de cobertura atual. |
| RF15 | Rotina existente `python -m app.cli refresh` disponível para execução explícita. Agendamento recorrente e homologação de atualizações em hospedagem ficam pendentes. |
| Entrega do professor | Dashboard, indicadores, relatórios consolidados, CSV da série e PDF com estatísticas e gráficos. Testes funcionais e de aceitação, roteiro, capturas atualizadas e pacote local. |
| RNF01–RNF04 | Fluxos em Firefox e Chromium, três larguras de tela, interação por teclado e toque emulado e execução com tráfego externo bloqueado. |
| RNF05–RNF07, RNF09–RNF10 | SQLite íntegro, sem chaves órfãs. Backup restaurado com igualdade integral nas seis tabelas. Testes de ordenação, datas, unidades, deduplicação, rollback, ausência e trilha de cargas. Política operacional de backup automático fica para a hospedagem. |
| RNF08 | Ensaio local com a base entregue. O cenário formal da especificação com 1 milhão de registros e infraestrutura própria permanece pendente. |

## Testes executados

- **Python.** `python -m unittest discover -s tests -v`: 23/23 passaram. Inclui testes de integração com o TestClient, migração ENSO, períodos e fases inválidos, médias e somas, dias faltantes, revisões, rollback, consistência ANA, backup e integridade dos arquivos brutos.
- **Aceitação no navegador.** `node tests/browser.cjs` em Chromium 151.0.7922.34 e Firefox 153.0. Cinco abas, teclado, filtros, linha do tempo, comparações, consultas, gráficos, CSV, falhas HTTP, descarte de resposta antiga e recuperação. Capturas em 1366, 768 e 360 px, com verificação de largura também nas tabelas abertas. Chromium verificou toque e gráfico a 390 px em modo celular. A execução usou navegadores desktop e emulação móvel.
- **PDF.** O botão chama a impressão nativa. O PDF A4 gerado pelo Chromium foi aberto e conferido com gráficos, fontes, unidades, datas e cobertura. A exportação CSV inclui a série completa. O PDF é consolidado.
- **Dados.** Os 41.652 novos registros foram conferidos contra os arquivos oficiais arquivados. As 5.852 observações anteriores foram recuperadas para conferência exata da assinatura, incluindo as originais que receberam revisão oficial. Foram verificados os SHA-256 de 52 arquivos de cargas, integridade do SQLite e vínculos de origem. A documentação de dados descreve a revisão de 2026 e a lacuna de cotas recentes. [Detalhes do acervo](../data/README.md).
- **Desempenho local.** 100/100 respostas de comparação diária com 10 solicitações concorrentes, dois pontos/estações e três janelas de 24 meses. Em execução limitada a dois núcleos, p95 de 0,619 s e máximo de 0,897 s, medidos no cliente HTTP local com leitura do JSON. O teste usa 47.504 medições. A medição anterior sem afinidade de CPU obteve p95 de 2,555 s no mesmo ambiente compartilhado.
- **Execução portátil.** Extração em pasta limpa, carga a partir do snapshot e reinício com banco existente testados em Linux com Python 3.13.5. Windows e macOS têm instruções próprias no README e ainda aguardam execução em equipamento físico.

## Arquitetura e operação

`run.py` inicializa o SQLite quando necessário e inicia o Uvicorn. `app/ingest.py` carrega e audita fontes e `app/series.py` aplica recorte, fase e resolução. A interface usa as rotas `/api/catalog`, `/api/series` e `/api/compare`. Relatórios reutilizam as séries consultadas e os gráficos SVG locais. CSV é gerado no navegador e PDF usa o mesmo recorte com estilos de impressão.

A consulta funciona com o snapshot distribuído e as fontes externas bloqueadas. A rede é necessária para instalar as dependências ou importar novas séries. O [README](../README.md) reúne as instruções de execução e o que ficará para a publicação.
