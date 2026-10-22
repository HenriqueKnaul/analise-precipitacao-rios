# Entrega e validação do MVP

Revisão de 22/10/2026 sobre a aplicação existente em Python/FastAPI, SQLite e JavaScript sem framework. A base original, os adaptadores NOAA/NASA/ANA e o iniciador local foram preservados. O escopo é uma demonstração acadêmica de análise histórica do Alto Vale do Itajaí.

## Implementação

- Quatro áreas: Visão Geral, Análise Histórica, Comparação de Fenômenos e Dados e Metodologia.
- Histórico por ano ou intervalo de até cinco anos, fase ENSO, ponto de precipitação, variável e resolução diária/mensal.
- Comparação de até três episódios, anos ou intervalos, com duração comum opcional, cobertura e médias diárias descritivas.
- Classificação de El Niño, La Niña e neutralidade a partir das marcações oficiais da tabela RONI ERSSTv6 NOAA/CPC, preservando os meses sem classificação.
- Séries reais, lacunas explícitas, tabela acessível e CSV com procedência, unidades e classificação.
- Gráficos separados para chuva (mm) e nível (m), leitura por cursor/teclado, estados de consulta e erro, navegação responsiva.

## Dados preservados

São **5.852 medições reais**, das quais **4.538 de precipitação NASA POWER** em dois pontos e **1.314 médias diárias de nível ANA/SNIRH** da estação 83440000 em Ibirama. Nenhuma medição foi gerada para ampliar a cobertura.

Os **920 índices mensais centrais** do snapshot NOAA vão de janeiro/1950 a agosto/2026. A mesma tabela agora origina **94 janelas contíguas**: 25 de El Niño, 22 de La Niña e 47 neutras/sem episódio confirmado. “Neutro” reproduz a ausência de marcação de episódio na fonte, inclusive valores que ainda não satisfazem a persistência; meses sem índice ficam não classificados.

A última chuva válida é de 18/10/2026. Não há nível de rio para 2023–2024 ou 2026 na demonstração. A extensão temporal entre o primeiro e o último registro não representa cobertura contínua. Consulte [dados e procedência](../data/README.md).

## Verificação executada em 22/10/2026

- **23 testes Python de dados e API aprovados**: seis de ENSO, onze de séries/importação, quatro regressões e dois testes de API. Abrangem fases oficiais, migração/idempotência, filtros, lacunas/zero, agregação, unidades, consistência ANA, rollback, deduplicação, intervalos e cobertura. Os dois testes com `TestClient` também concluíram após a liberação do ambiente.
- **API HTTP real validada** com servidor local e banco temporário: restauração das 5.852 medições e 94 janelas; 1998 contém 365 dias de chuva, particionados em 120 quentes, 214 frios e 31 neutros. Filtros mantêm valores excluídos ausentes, rio em 2023 sem valores, La Niña em 2015 sem dias elegíveis, setembro/outubro de 2026 sem índice não entram como neutros; intervalo invertido retorna 422.
- **Integridade e rastreabilidade verificadas**: igualdade exata das 5.852 medições e registros de ingestão com a base anterior, preservação dos valores/datas/IDs de carga dos 920 índices, 21 hashes de artefatos brutos corretos, `integrity_check` e `foreign_key_check` aprovados.
- **Playwright aprovado em Edge/Chromium**: quatro abas, navegação por teclado, filtros por ano/data/fase/estação/resolução, gráficos interativos, comparação de até três períodos, exportações CSV, carregamento, respostas fora de ordem, falha HTTP e recuperação, recarregamento, reinício e abertura direta do HTML. Zero erros JavaScript ou falhas de recursos; consulta validada com tráfego externo bloqueado. As quatro abas e tabelas expandidas foram verificadas em 1366, 768 e 360 pixels, sem transbordamento horizontal. Capturas atualizadas em `docs/screenshots/`; revisão visual corrigiu o contraste do título da visão geral.

`tests/browser.cjs` usa um banco descartável e uma porta local disponível. Inicia/encerra o servidor, impede tráfego externo e grava capturas em `output/screenshots/`. Não altera o banco usado na apresentação. As instruções reproduzíveis estão no [README](../README.md).

## Limitações

1. As janelas de precipitação e nível são descontínuas. Ampliar cobertura exige novas cargas das fontes; a interface não interpola nem substitui ausência por zero.
2. NASA POWER é produto em grade, não pluviômetro físico. Pontos próximos podem compartilhar a mesma célula. O nível ANA é uma cota local, sem referencial altimétrico conhecido nesta base.
3. As datas ENSO são meses centrais de temporadas móveis de três meses, não datas físicas diárias de início/fim. A análise é descritiva; diferenças não comprovam causalidade, anomalia climatológica ou significância estatística.
4. O acervo local não é monitoramento em tempo real, previsão ou alerta. O comando de atualização continua disponível, mas não foi instalado agendamento do sistema operacional.
5. Não foram executados ensaios de produção com um milhão de medições/dez usuários, homologação em Firefox, leitor de tela ou recuperação de falha abrupta. Não se afirma meta de latência de produção.
6. SQLite atende a execução local. Migração para PostgreSQL, papéis de acesso e infraestrutura pública permanecem fora do escopo deste MVP.
