## Hospedagem online — Render

O sistema **Chuva × Rio — Projeto Integrador II** está publicado e disponível para acesso público.

**Acesse o sistema:**

https://analise-precipitacao-rios.onrender.com/#overview

### Informações da hospedagem

- **Plataforma:** Render
- **Tipo de serviço:** Web Service
- **Linguagem:** Python 3
- **Backend:** FastAPI
- **Banco de dados:** SQLite
- **Frontend:** HTML, CSS e JavaScript
- **Repositório:** GitHub
- **Branch de produção:** `main`

### Configuração da publicação

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
python run.py --host 0.0.0.0 --port $PORT --no-browser
```

A aplicação inicializa automaticamente o banco SQLite quando necessário, utilizando o acervo histórico distribuído com o projeto.

### Funcionalidades disponíveis

- Dashboard com indicadores históricos.
- Visualização interativa de precipitação e nível dos rios.
- Análise de El Niño, La Niña e neutralidade.
- Comparação entre períodos e eventos climáticos.
- Filtros por localidade, período e resolução temporal.
- Relatórios consolidados.
- Exportação de dados em CSV.
- Geração de relatórios em PDF.
- Consulta às fontes e à metodologia utilizada.

### Disponibilidade e dados

A hospedagem utiliza o plano gratuito do Render. Após períodos de inatividade, o primeiro acesso pode apresentar um tempo adicional de carregamento.

O banco SQLite é inicializado a partir do snapshot histórico incluído no repositório. Os dados de demonstração podem ser recuperados em novas inicializações.

Alterações realizadas exclusivamente no armazenamento temporário da hospedagem não são preservadas permanentemente.

### Execução local

O projeto também pode ser executado localmente, seguindo as instruções de instalação apresentadas anteriormente neste README.

A execução local permite utilizar a aplicação e consultar o acervo histórico mesmo sem conexão com a internet, após a instalação das dependências.

### Documentação complementar

- [Especificação acadêmica](docs/Chuva_x_Rio_Especificacao_Revisada_28-09-2026.pdf)
- [Roteiro de apresentação](docs/DEMONSTRACAO.md)
- [Validação e testes](docs/STATUS_MVP.md)
- [Documentação dos dados](data/README.md)

---

**Projeto Integrador II — UDESC CEAVI**

**Desenvolvedores:** Breno Batista Pascoalin e Henrique Knaul. de `CHUVA_DB`, arquivos brutos e backups antes da publicação. [Persistent Disks](https://render.com/docs/disks).
