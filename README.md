# Matemática Passo a Passo

Ferramenta pessoal de matemática para estudar: solver passo a passo (como o Symbolab/Mathway), calculadora CAS e guias de estudo com gráficos interativos. Tudo gratuito.

## O que tem

- **Resolver passo a passo**: derivadas, integrais (imediatos, substituição, por partes, cíclicos, frações simples, definidos), limites (substituição, fatorização, L'Hôpital, no infinito), equações e sistemas/matrizes pelo método de Gauss.
  - resolução completa ou **um passo de cada vez**, com **pistas**
  - em cada passo: a regra usada, o "porquê" e o botão **"🤖 Não percebi este passo"**
  - **métodos alternativos**, quando existem
  - **gráfico** ligado ao exercício (função, derivada, primitiva, área do integral)
  - **modo treino**: resolves tu e o site verifica
  - **"Dá-me outro igual"**: gera um exercício parecido
  - **📷 foto do exercício** (ou colar uma imagem com Ctrl+V)
- **Calculadora CAS**: cálculo simbólico exato (derivar, integrar, limites, equações, matrizes, determinantes, valores próprios, Laplace, EDOs, complexos, Taylor…), com "ver passos".
- **Guias de estudo**: Matemática A, Pré-Cálculo, Álgebra, Álgebra Linear, Cálculo 1 e Cálculo 2. O guia de **Funções** está completo. Os outros têm o índice de temas e vão sendo escritos.

## Como funciona (sem custos)

- O motor matemático é o **SymPy** a correr **dentro do browser** através do **Pyodide**. Não há servidor nem contas. Na primeira visita descarrega cerca de 30 MB, que depois ficam em cache.
- A leitura de fotos e as explicações "não percebi" usam a **API gratuita do Google Gemini**. Cria-se uma chave grátis em <https://aistudio.google.com/apikey> e cola-se em **Definições**. A chave fica só no teu browser. No plano gratuito, a Google pode usar o conteúdo enviado para melhorar os seus produtos.

## Estrutura

```
index.html          página principal (solver, CAS, definições)
css/style.css       estilos
js/app.js           interface
js/grafico.js       desenhador de gráficos (canvas)
js/engine_src.js    gerado a partir de py/engine.py (não editar à mão)
py/engine.py        motor matemático (passos)
guias/              guias de estudo
build.py            gera js/engine_src.js
```

Depois de alterar `py/engine.py`, corre `python3 build.py`.

## Publicar com GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
Fica disponível em `https://lucaslopeslacerda.github.io/matematica/`.

Também funciona a abrir o `index.html` diretamente no computador, desde que haja internet para descarregar o motor.
