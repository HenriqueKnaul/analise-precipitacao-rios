# Demonstração de 22/10/2026

## Preparação

Instale as dependências pelo procedimento do README antes da aula. Execute `python run.py` usando o Python do ambiente virtual ou abra `iniciar.cmd`. O iniciador prepara o snapshot se o banco estiver vazio, preserva bancos já carregados e abre o navegador em `http://127.0.0.1:8000/`. Não abra `static/index.html` diretamente. Mantenha o terminal aberto.

A consulta usa arquivos locais e a API interna: após instalar e carregar, funciona sem internet. Se estiver retomando um banco antigo, use um novo caminho `CHUVA_DB` para demonstrar o snapshot atualizado sem substituir o histórico anterior. A base inclui 4.538 medições de chuva e 1.314 médias diárias reais de nível da ANA.

## Roteiro de aproximadamente 5 minutos

1. **Contexto e linha do tempo.** Apresente Chuva x Rio, recorte do Alto Vale e fontes NOAA/CPC, NASA POWER e ANA/SNIRH. Explique que é análise histórica, sem alertas ou previsão. Os episódios usam os meses centrais das temporadas marcadas pela NOAA.
2. **Chuva entre eventos.** Selecione 2014–2016 e 2023–2024, ponto Ibirama, precipitação e resolução mensal. Mostre os acumulados, as unidades, a legenda e o trecho comum de oito meses. As datas originais continuam visíveis: o alinhamento relativo não controla sazonalidade.
3. **Nível real e lacunas.** Remova 2023–2024 e selecione 1997–1998, mantendo 2014–2016. Escolha chuva e nível e a estação ANA 83440000 — Ibirama. Mostre os dois painéis e a cobertura. Troque para diária para observar a interrupção de curvas onde faltam dias. A cota foi convertida de cm para m, mas não é altitude absoluta: o referencial não foi informado.
4. **Filtros e período atual.** Volte à precipitação, selecione os eventos desejados e inclua o período atual. A última observação de chuva no snapshot é 18/10/2026, não a data da apresentação. Mostre também o intervalo personalizado: use início no dia 1 em comparação mensal com trecho comum ou resolução diária para datas arbitrárias. Troque o ponto municipal e explique que NASA é um produto em grade, não uma estação física.
5. **Transparência.** Abra a tabela, exporte CSV e mostre fontes e cargas. Selecione nível em 2023–2024 para mostrar a mensagem de ausência real. A consulta feita à ANA não retornou essa série; não foram criados valores para completar o gráfico.

## Dados de nível apresentados

A série real é da estação **83440000 — Ibirama, Rio Itajaí do Norte/Hercílio**. O arquivo de metadados `data/ibirama-ana.json` preserva coordenadas, referências, inventário e hash. O adaptador XML aceita registros consistidos, médias diárias e status diário real, com conversão de centímetros para metros.

Na janela 1997–1998, há 522 dias válidos e 208 ausentes. Na janela de novembro de 2014 a dezembro de 2016, há 792 dias válidos. O gráfico recorta essas séries conforme os eventos ou datas selecionados; seus totais podem diferir da janela completa da carga. Ainda falta ampliar a cobertura de nível recente/atual e confirmar o referencial de cota.

## O que não concluir

Não interpretar correlação visual como causalidade, previsão, cota de alerta ou classificação de “Super El Niño”. Totais com cobertura parcial não representam meses completos. Pontos municipais próximos podem compartilhar a mesma célula NASA. Cotas de estações diferentes não equivalem a elevações absolutas e ficam em painéis separados.
