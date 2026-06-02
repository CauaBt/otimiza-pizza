# Otimiza Pizza 🍕 — Otimizador de Produção de Pizzas

Este projeto consiste em uma aplicação web interativa de alto padrão visual (Premium Dashboard) projetada para modelar, resolver e visualizar o problema de programação linear para maximização de lucros na fabricação de pizzas.

A aplicação permite ajustar de forma dinâmica o estoque de ingredientes e as receitas de cada pizza, atualizando em tempo real a solução ótima, os gargalos e a **Região Viável de Decisão** em um gráfico bidimensional.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [Vue 3](https://vuejs.org/) (Vite, Single File Components, Chart.js via CDN/NPM, CSS3 moderno em Glassmorphism).
- **Backend:** [Python 3](https://www.python.org/) (Flask, Flask-CORS) com solucionador de Programação Linear por **Enumeração de Vértices** customizado.
- **Orquestração:** Script em lote do Windows (`run.bat`) para instalação e execução simplificada.

---

## 📋 Modelo de Programação Linear (LP)

### Variáveis de Decisão
- $x_1$: Quantidade de pizzas de **Muçarela** a produzir.
- $x_2$: Quantidade de pizzas de **Calabresa** a produzir.

### Função Objetivo
Maximizar o lucro total:
$$\text{Max } Z = c_1 x_1 + c_2 x_2$$
*(Onde $c_1$ e $c_2$ são os lucros individuais de cada pizza. Padrões: $c_1 = \$12,00$, $c_2 = \$15,00$)*

### Ingredientes e Restrições de Receita
As restrições de estoque total são configuradas por sliders e expressas na forma:
$$a_{i1} x_1 + a_{i2} x_2 \le \text{Estoque Disponível}_i$$

Receitas padrão:
1. **Muçarela ($x_1$):**
   - 0.5 kg de Farinha
   - 0.3 kg de Queijo
   - 0.2 kg de Molho
   - 0.2 kg de Manteiga (para untar a forma, regulando o teste do gargalo)
2. **Calabresa ($x_2$):**
   - 0.5 kg de Farinha
   - 0.2 kg de Queijo
   - 0.2 kg de Molho
   - 0.15 kg de Calabresa
   - 0.2 kg de Manteiga (para untar)

---

## 🚀 Como Executar o Projeto

Para executar este projeto no Windows, basta ter **Python 3** e **Node.js** instalados e no seu PATH de sistema.

1. Baixe ou navegue até a pasta do projeto `c:\Users\cauab\OneDrive\Documentos\DSC`.
2. Dê um duplo clique no arquivo **`run.bat`** (ou execute no terminal CMD: `run.bat`).
3. O script irá:
   - Instalar as dependências do Flask (`requirements.txt`).
   - Instalar as dependências do Vue 3 (`npm install`).
   - Iniciar o backend na porta `5000` em segundo plano.
   - Iniciar o frontend Vite na porta `5173`.
   - Abrir o seu navegador padrão automaticamente em `http://localhost:5173`.

*Nota: Se preferir rodar manualmente no terminal:*
- **Backend:** `cd backend && python -m pip install -r requirements.txt && python app.py`
- **Frontend:** `cd frontend && npm install && npm run dev`

---

## 🧪 Casos de Validação

Você pode testar a consistência do algoritmo usando o painel **"Cenários de Validação Rápida"** diretamente no dashboard:

1. **Cenário 1: Gargalo de Manteiga**
   - **Configuração:** Estoques: Farinha = 150 kg, Manteiga = 25 kg, Queijo = 50 kg, Molho = 160 kg.
   - **Resultado Esperado:** Otimização indica produção de exatamente **125 pizzas** de Muçarela (Modo 1), apontando a **Manteiga** como gargalo (100% de uso).

2. **Cenário 2: Gargalo de Farinha**
   - **Configuração:** Manteiga sobe para 40 kg, Farinha em 75 kg (mantendo os demais estoques).
   - **Resultado Esperado:** Otimização sobe para exatamente **150 pizzas** de Muçarela (Modo 1), apontando a **Farinha** como novo gargalo (100% de uso, com Manteiga caindo para 75% de uso).
