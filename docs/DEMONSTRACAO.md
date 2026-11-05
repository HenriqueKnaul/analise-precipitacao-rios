# Roteiro de apresentação — Chuva × Rio

## Preparação

Instale as dependências conforme o README. Execute `python run.py` com o Python do ambiente virtual ou abra `iniciar.cmd` no Windows. O sistema abre em http://127.0.0.1:8000/. Mantenha o terminal aberto. Após a instalação, a demonstração funciona sem internet.

Bancos existentes são preservados e o calendário ENSO antigo é migrado automaticamente. Em uma pasta nova, o snapshot carrega 47.504 medições, 920 índices RONI e 94 janelas. O calendário vai de 1950 a agosto de 2026. A precipitação começa em 1981 e chega a 18/10/2026. As cotas disponíveis vão de 1981 a 2021, com lacunas.

## Demonstração de 5–7 minutos

1. **Visão Geral.** Apresente o Alto Vale do Itajaí e os indicadores do acervo. Mostre o resumo da precipitação e explique que se trata de observação histórica, sem previsão nem alerta. O último dado de chuva é 18/10/2026.
2. **Explorar histórico.** Selecione **2016** e **chuva e nível**. Em **Local e detalhamento**, confira **Ibirama** e **mensal**. O ano possui cobertura completa de ambas as variáveis. Passe pelos filtros **El Niño**, **La Niña** e **Neutro / sem episódio**: os pontos mudam e os meses excluídos não são tratados como falta de medição. Retorne a todas as fases; consulte um ponto do gráfico e a tabela.
3. **Detalhes e lacunas.** Em **Local e detalhamento**, troque para diária e abra **Ver maiores valores observados**. Selecione **1998** para ver lacunas reais de nível; depois **2023** para demonstrar chuva disponível e nível indisponível. Não interprete ausência como nível zero. Restaure os filtros.
4. **Comparar períodos.** Use **Usar El Niño × La Niña** para carregar episódios com observações locais. Cada cartão reúne média diária, acumulado e cobertura de um período. Selecione chuva e nível. Alterne **Comparar durações iguais** para observar também os comprimentos originais; explique que alinhar o tempo não controla sazonalidade. Remova um período, abra **Adicionar um período**, escolha um ano ou intervalo de datas e mostre que os gráficos respondem. Em seguida selecione apenas **Precipitação** e adicione **Período atual** para mostrar o corte na última observação.
5. **Relatórios.** Use 01/01/2016 a 31/12/2016 e selecione as duas variáveis. Mostre média, máximo, acumulado de chuva e dias válidos. Exporte o CSV e escolha **Salvar como PDF** no diálogo do navegador para gerar o resumo com os gráficos.
6. **Fontes e método.** Mostre as três fontes, filtre a linha do tempo por uma fase e abra um período histórico. Volte a Fontes e método e abra **Como identificamos as fases?**. A NOAA usa o RONI ERSSTv6; o aplicativo reproduz as classes oficiais dos meses centrais das temporadas. Neutro significa sem episódio confirmado na tabela, e mês sem índice permanece sem classificação.

## Mensagens essenciais

- NASA POWER é produto em grade: os dois pontos consultados retornaram valores diários iguais no acervo. ANA representa uma estação física, 83440000 — Ibirama, Rio Itajaí do Norte/Hercílio.
- Nível é média diária consistida, convertida de cm para m. O referencial altimétrico não foi informado.
- Chuva mensal é soma dos dias válidos; nível mensal é média. Um mês parcial não é equivalente a um mês completo.
- Diferenças históricas não comprovam causalidade entre ENSO, chuva e rio. Os máximos não são alertas ou anomalias climatológicas.
- O nível está disponível até 31/12/2021. As consultas posteriores ao serviço legado não retornaram médias diárias consistidas elegíveis.
