<h1 align="center">🌧️ Chuva x Rio</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow" alt="Status do Projeto">
  <img src="https://img.shields.io/badge/Disciplina-Projeto%20Integrador%20II-blue" alt="Disciplina">
  <img src="https://img.shields.io/badge/Institui%C3%A7%C3%A3o-UDESC%20CEAVI-green" alt="Instituição">
</p>

<p align="center">
  <strong>Sistema Web para Análise Histórica e Comparativa de Eventos de El Niño no Alto Vale do Itajaí.</strong>
</p>

<hr>

## 📌 Sobre o Projeto

O **Chuva x Rio** é uma aplicação web destinada à organização, integração e visualização de dados históricos de precipitação e do nível dos rios. A plataforma reúne séries temporais de fontes públicas meteorológicas e hidrológicas referentes a períodos em que o fenômeno climático El Niño foi registrado.

O sistema baseia-se na **Arquitetura de Referência RADIAN** e atua como uma ferramenta de análise histórica. O objetivo não é fornecer alertas operacionais de enchentes, mas sim permitir a observação visual de padrões, diferenças e magnitudes comparando eventos históricos entre si e com o período atual.

## 🚀 Funcionalidades Principais

* **Linha do Tempo Interativa:** Navegação centrada nos eventos de El Niño, baseada nos índices oficiais da NOAA (RONI/ONI).
* **Comparação Histórica:** Sobreposição gráfica de séries temporais de precipitação e nível dos rios de diferentes períodos.
* **Coleta Automatizada em Lote (Batch):** Integração com APIs e repositórios públicos (NASA POWER, ANA/SNIRH) para atualização de dados sem dependência manual.
* **Transparência e Qualidade:** Indicação clara das fontes de origem e identificação visual de lacunas de dados (sem interpolação artificial).

## 🛠️ Stack Tecnológica

**Back-end & Integração:**
* Java 17+
* Spring Boot (REST APIs, Data JPA)
* Bancos de Dados Relacionais (MySQL / PostgreSQL / SQLite)

**Front-end & Visualização:**
* HTML5, CSS3, JavaScript
* LESS (Pré-processador CSS)
* Figma (Prototipação)

## 🏗️ Arquitetura e Fluxo de Dados

O fluxo do sistema opera nas seguintes etapas:
1. **Coleta:** Adaptadores consultam as fontes externas (NOAA, NASA POWER, ANA).
2. **Normalização:** Conversão para um formato unificado, preservando unidades e origens.
3. **Persistência:** Armazenamento histórico no banco de dados da aplicação.
4. **Análise e Alinhamento:** Recuperação dos dados compatíveis com a consulta do usuário.
5. **Interface:** Exibição em gráficos e linha do tempo.

## 📁 Estrutura do Repositório

```text
├── src/          # Código-fonte da aplicação (API, adaptadores e Front-end)
├── docs/         # Documentação técnica, Especificação Completa e diagramas UML
├── data/         # Scripts de banco de dados e amostras de dados para testes
└── assets/       # Imagens, ícones, logotipos e gráficos do sistema