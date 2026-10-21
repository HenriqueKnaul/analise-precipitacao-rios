# Demonstração de 22/10/2026

## Preparação

Execute o procedimento do README, incluindo `python -m app.cli demo`. Faça a instalação das dependências antes da apresentação. A interface usa apenas arquivos locais e a API interna: depois da carga, pode operar sem internet. Mantenha o terminal do servidor aberto.

## Roteiro de 5–7 minutos

1. Apresente o recorte: Alto Vale, Ibirama e Presidente Getúlio; análise histórica, sem alertas ou previsão.
2. Mostre a linha do tempo da NOAA e os episódios de 2014–2016 e 2023–2024 selecionados. Explique a convenção dos meses centrais e que o RONI é a referência climática, não uma classificação baseada na chuva local.
3. Compare a chuva mensal. O trecho comum tem oito meses; os rótulos e a tabela mostram datas originais. O alinhamento relativo não controla sazonalidade: meses civis diferentes podem ser comparados e isso limita conclusões causais.
4. Desative “trecho comum” e veja comprimentos distintos. Troque para diária e consulte a tabela; zero válido é diferente de célula sem dado.
5. Adicione “Período atual”. Mostre a última observação publicada, 18/10/2026, em vez de prometer dados até o dia da demonstração. O corte é aplicado aos históricos pelo mesmo comprimento relativo.
6. Troque o ponto municipal e explique produto em grade versus estação física. Exporte o CSV.
7. Selecione nível dos rios. Declare que falta o arquivo regional validado; o importador e o gráfico estão prontos e foram testados, mas **não há resultado hidrológico real para apresentar nesta entrega**. Mostre origem, cobertura e histórico das cargas.

## Próximo passo para ativar nível real

Obter um arquivo histórico público ANA/SNIRH adequado à região, conferir código, coordenadas, unidade e estatística diária. Preparar CSV UTF-8 `date,value` e metadados conforme README. A importação aceita nível médio diário documentado; não converte automaticamente observações subdiárias nem arquivos HidroWeb mensais brutos.

## O que não concluir

Não interpretar correlação visual como causalidade, previsão, cota de alerta ou classificação de “Super El Niño”. Totais com cobertura parcial não representam meses completos. Cotas de estações diferentes não equivalem a elevações absolutas e ficam em painéis separados.
