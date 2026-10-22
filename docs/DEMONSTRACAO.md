# Roteiro de apresentação — Chuva × Rio

## Preparação

Instale as dependências conforme o README. Execute `python run.py` com o Python do ambiente virtual ou abra `iniciar.cmd` no Windows. O sistema abre em http://127.0.0.1:8000/. Mantenha o terminal aberto. Após a instalação, a demonstração funciona sem internet.

Bancos existentes são preservados e o calendário ENSO antigo é migrado automaticamente. O snapshot possui 5.852 medições reais, 920 índices RONI e 94 janelas de classificação. O calendário vai de 1950 a agosto de 2026; os dados locais são descontínuos entre 1997 e 2026.

## Demonstração de 5–7 minutos

1. **Visão Geral.** Apresente o Alto Vale do Itajaí e os indicadores do acervo. Mostre o resumo da precipitação e explique que se trata de observação histórica, sem previsão nem alerta. O último dado de chuva é 18/10/2026.
2. **Explorar histórico.** Selecione **2016** e **chuva e nível**. Em **Local e detalhamento**, confira **Ibirama** e **mensal**. O ano possui cobertura completa de ambas as variáveis. Passe pelos filtros **El Niño**, **La Niña** e **Neutro / sem episódio**: os pontos mudam e os meses excluídos não são tratados como falta de medição. Retorne a todas as fases; consulte um ponto do gráfico e a tabela.
3. **Detalhes e lacunas.** Em **Local e detalhamento**, troque para diária e abra **Ver maiores valores observados**. Selecione **1998** para ver lacunas reais de nível; depois **2023** para demonstrar chuva disponível e nível indisponível. Não interprete ausência como nível zero. Restaure os filtros.
4. **Comparar períodos.** Use **Usar El Niño × La Niña** para carregar episódios com observações locais. Cada cartão reúne média diária, acumulado e cobertura de um período. Selecione chuva e nível. Alterne **Comparar durações iguais** para observar também os comprimentos originais; explique que alinhar o tempo não controla sazonalidade. Remova um período, abra **Adicionar um período**, escolha um ano ou intervalo de datas e mostre que os gráficos respondem.
5. **Exportação.** Abra a tabela e baixe o CSV. Ele preserva datas, unidade, fonte e cobertura. Compare dados do mesmo ponto/estação; não sobreponha cotas de estações diferentes como se fossem altitudes equivalentes.
6. **Fontes e método.** Mostre as três fontes, o período de cobertura e abra **Como identificamos as fases?**. A NOAA usa o RONI ERSSTv6; o aplicativo reproduz as classes oficiais dos meses centrais das temporadas. Neutro significa sem episódio confirmado na tabela, e mês sem índice permanece sem classificação.

## Mensagens essenciais

- NASA POWER é produto em grade: pontos próximos podem compartilhar a mesma célula. ANA representa uma estação física, 83440000 — Ibirama, Rio Itajaí do Norte/Hercílio.
- Nível é média diária consistida, convertida de cm para m. O referencial altimétrico não foi informado.
- Chuva mensal é soma dos dias válidos; nível mensal é média. Um mês parcial não é equivalente a um mês completo.
- Diferenças históricas não comprovam causalidade entre ENSO, chuva e rio. Os máximos não são alertas ou anomalias climatológicas.
- O período 2023–2024 e o ano atual não têm nível no snapshot. Nenhuma medição foi criada para completar a apresentação.
