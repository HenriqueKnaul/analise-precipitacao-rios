# Entrega e validação

Base examinada: branch `main`, commit `dbcaba4`. Havia apenas README e PDF; os diretórios de código mencionados no README não existiam. Mantidos o escopo, autores, fontes e documento de especificação. Implementação em Python/FastAPI conforme proposta da seção 28.1; SQLite substitui PostgreSQL para execução local. Não há código Java existente a migrar.

| Requisitos | Situação nesta entrega |
|---|---|
| RF01 | Coletor NASA real, com arquivos brutos e normalização diária |
| RF02 | Importador CSV diário normalizado implementado e testado; aquisição/validação do arquivo regional ANA pendente |
| RF03, RF06, RF09 | Índices e calendário RONI importados da marcação da NOAA; linha do tempo selecionável |
| RF04, RF05 | SQLite persistente, FKs, chave única, revisão e procedência |
| RF07 | Gráfico diário e mensal de chuva real |
| RF08, RF12 | Gráfico/comparação de nível implementados; teste com amostra controlada, sem série real incluída |
| RF10, RF11, RF14 | Até três períodos, mesma variável e estação, alinhamento relativo, trecho comum opcional |
| RF13 | Janela atual independente, corte por último dado válido; sem extrapolação |
| RF15 | Comando `refresh`, carga incremental com sobreposição, duas tentativas e serialização no banco; agendamento do sistema operacional não instalado |
| RF16–RF18 | Fontes, coordenadas, unidades, coleta, cobertura, lacunas e exportação |

## Testes executados em 21/10/2026

- Nove testes Python de API e dados aprovados: zero versus ausência, soma e cobertura de fevereiro bissexto, cm→m/média, sentinelas/unidades inválidas, duplicação/revisão, rollback, falha de rede, classificação pela fonte, corte atual, meses completos de durações diferentes, FKs e backup/restauração por amostra.
- Snapshot restaurado em banco novo: 4.538 medições de precipitação e 25 episódios; integridade SQLite aprovada, nenhuma violação de chave estrangeira.
- Cargas reais NOAA e NASA concluídas; 2026 parcialmente publicado e identificado como tal.
- Testes de interface automatizados em Chromium headless: larguras 1366/768/360, dois períodos iniciais, resolução diária, mensagem de rio ausente, inclusão do período atual e CSV. Sem erro JavaScript ou rolagem horizontal da página. O gráfico e tabelas têm rolagem própria em telas pequenas.
- Capturas de desktop e celular inspecionadas visualmente.

Os comandos reproduzíveis estão no README. Os testes não substituem homologação em Chrome e Firefox estáveis, nem os ensaios com 1 milhão de medições e 10 usuários da especificação. Nenhuma meta de latência de produção é afirmada.

## Pendências e diferenças do projeto completo

1. **Dados de nível reais:** selecionar e validar estação/arquivo ANA da região; adaptar o formato bruto específico e documentar o referencial de cota. A transformação para o CSV intermediário ainda é manual. Não há prova de integração fim a fim com HidroWeb nesta entrega.
2. Migrar para PostgreSQL e implementar o esquema físico completo da seção 29, com papéis distintos para consulta/coleta. SQLite reúne as duas variáveis em uma tabela, identificadas pelo tipo da estação; não reproduz exatamente as sete entidades propostas.
3. Instalar o agendamento, testar concorrência operacional e recuperação de falhas abruptas, monitorar cargas e rotacionar backups. `refresh` faz backup; cargas avulsas exigem `backup` explícito. O timeout e duas tentativas são limitados, sem backoff sofisticado.
4. Expandir cobertura histórica, validar chuva com INMET/MERGE e validar representatividade espacial dos pontos em grade. A timeline contém eventos sem dados locais; isso está informado.
5. Evoluir auditoria para relatórios completos de rejeições por linha e versionamento automático do formato NOAA; reter versões anteriores já é possível pelos artefatos e registros de carga. Uma mudança nas classes da tabela faz a carga falhar, preservando o histórico.
6. Homologação Chrome/Firefox, acessibilidade assistiva, impressão monocromática e ensaios de desempenho/recuperação conforme RNF. A aplicação local não é um serviço público endurecido para produção; publicação exige configuração de servidor, HTTPS e revisão operacional.

Os gráficos de nível usam uma estação selecionada por consulta; não há sobreposição de cotas de estações distintas. Na API, duas estações produzem séries separadas e a interface as agrupa por estação. A comparação atual conjunta sem uma das variáveis informa que não existe corte comum, e permite consultar a variável disponível isoladamente.
