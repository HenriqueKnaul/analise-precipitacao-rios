# Entrega e validação

Base examinada: branch `main`, commit `dbcaba4`. Havia apenas README e PDF; os diretórios de código mencionados no README não existiam. Mantidos o escopo, autores, fontes e documento de especificação. Implementação em Python/FastAPI conforme proposta da seção 28.1; SQLite substitui PostgreSQL para execução local. Não há código Java existente a migrar. A revisão atual parte da implementação local `e066dcf`, preservando seus dados e adaptadores.

| Requisitos | Situação nesta entrega |
|---|---|
| RF01 | Coletor NASA real, com arquivos brutos e normalização diária |
| RF02 | Adaptador XML público ANA/SNIRH e importador CSV; série real da estação 83440000 Ibirama incluída |
| RF03, RF06, RF09 | Índices e calendário RONI importados da marcação da NOAA; linha do tempo selecionável |
| RF04, RF05 | SQLite persistente, FKs, chave única, revisão e procedência |
| RF07 | Gráfico diário e mensal de chuva real |
| RF08, RF12 | Gráfico e comparação de nível real de Ibirama em 1997–1998 e 2014–2016, com lacunas explícitas |
| RF10, RF11, RF14 | Até três períodos, intervalo personalizado, mesma variável e estação, alinhamento relativo e trecho comum opcional |
| RF13 | Janela atual independente, corte por último dado válido; sem extrapolação |
| RF15 | Comando `refresh`, carga incremental com sobreposição, duas tentativas e serialização no banco; agendamento do sistema operacional não instalado |
| RF16–RF18 | Fontes, coordenadas, unidades, coleta, cobertura, lacunas e exportação |

## Correções de abertura e interface

O problema de abertura foi reproduzido a partir do endereço informado pelo usuário: `file:///.../static/index.html`. A versão anterior usava caminhos absolutos `/static/...`, que não localizavam os arquivos nessa abertura, e o HTML não iniciava a API Python. Esta revisão usa caminhos relativos para os recursos e exibe instruções claras em `file://`, sem fingir que a API está ativa.

`python run.py` carrega o snapshot somente em banco vazio, inicia FastAPI e abre o navegador no endereço HTTP correto. `iniciar.cmd` facilita essa execução no Windows após a instalação. Acesso legado a `/static/index.html` pelo servidor redireciona para a aplicação. O dashboard organiza filtros, eventos com dados locais, seleção dos períodos, gráficos e fontes. A captura está em `docs/screenshots/dashboard.png`.

## Verificação

Validação executada em 21/10/2026:

- **16 testes Python aprovados**: API/recursos estáticos, zero e lacunas, soma/média/unidades, qualidade ANA, revisão/deduplicação, rollback, backup, integridade referencial, meses incompletos, corte atual e preservação do histórico diante de resposta NOAA truncada.
- **Chromium executou a aplicação completa** com banco SQLite novo: restauração automática de 5.852 medições (4.538 de chuva e 1.314 de nível) e 25 episódios. O catálogo permaneceu idêntico após encerrar e reiniciar o servidor.
- Navegação com cliques reais: CSS, gráficos/legendas, município, seleção de eventos, diária/mensal, trecho comum/completo, período atual com último dado de chuva em 18/10/2026, ANA real em metros, intervalo personalizado, mensagens de ausência e recarregamento da página.
- CSV baixado e conferido quanto a fonte, unidade e número de linhas; testes em larguras 1366, 768 e 360 sem transbordamento horizontal da página. Zero erros JavaScript ou falhas de recursos na navegação. Requisições HTTPS externas bloqueadas durante o ensaio para validar operação offline.
- Abertura por `file://` verificada: CSS local carregado e orientação para iniciar o servidor, em vez de filtros inoperantes.
- Capturas da interface inspecionadas visualmente. Arquivos finais em `docs/screenshots/`. Todos os hashes SHA-256 dos artefatos do snapshot conferidos; `PRAGMA integrity_check` e `foreign_key_check` aprovados.

Os comandos reproduzíveis estão no README; `tests/browser.cjs` inicia e encerra um servidor temporário e usa uma base descartável, sem alterar o banco da apresentação.

Os testes locais não substituem homologação em Chrome e Firefox estáveis, nem os ensaios com 1 milhão de medições e 10 usuários da especificação. Nenhuma meta de latência de produção é afirmada.

## Pendências e diferenças do projeto completo

1. **Ampliar a cobertura de nível:** a estação Ibirama já tem série real importada pelo serviço público ANA, porém faltam dados para 2023–2024 e para o período atual na base da demonstração. Confirmar disponibilidade/revisões na origem e documentar o referencial altimétrico, ainda desconhecido. Não assumir que lacunas são nível zero.
2. Migrar para PostgreSQL e implementar o esquema físico completo da seção 29, com papéis distintos para consulta/coleta. SQLite reúne as duas variáveis em uma tabela, identificadas pelo tipo da estação; não reproduz exatamente as sete entidades propostas.
3. Instalar o agendamento, testar concorrência operacional e recuperação de falhas abruptas, monitorar cargas e rotacionar backups. `refresh` faz backup; cargas avulsas exigem `backup` explícito. O timeout e duas tentativas são limitados, sem backoff sofisticado.
4. Expandir cobertura histórica, validar chuva com INMET/MERGE e validar representatividade espacial dos pontos em grade. A timeline contém eventos sem dados locais; isso está informado.
5. Evoluir auditoria para relatórios completos de rejeições por linha e versionamento automático do formato NOAA; reter versões anteriores já é possível pelos artefatos e registros de carga. Uma mudança nas classes da tabela faz a carga falhar, preservando o histórico.
6. Homologação Chrome/Firefox, acessibilidade assistiva, impressão monocromática e ensaios de desempenho/recuperação conforme RNF. A aplicação local não é um serviço público endurecido para produção; publicação exige configuração de servidor, HTTPS e revisão operacional.

Os gráficos de nível usam uma estação selecionada por consulta; não há sobreposição de cotas de estações distintas. Na API, duas estações produzem séries separadas e a interface as agrupa por estação. A comparação atual conjunta sem uma das variáveis informa que não existe corte comum e permite consultar a variável disponível isoladamente. Para comparação mensal de múltiplas janelas com trecho comum, os inícios devem ser no primeiro dia do mês; na resolução diária, podem ser quaisquer datas válidas. Isso evita alinhar pedaços incompatíveis de meses como se fossem meses completos.
