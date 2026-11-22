"""Gera as páginas dos guias a partir dos fragmentos em guias/src/.
Cada fragmento começa com:  <!-- titulo: Cálculo 1 -->  e tem <section id="…"><h2>…</h2>…</section>.
Uso:  python3 guias/gerar.py
"""
import pathlib
import re

AQUI = pathlib.Path(__file__).parent
MODELO = """<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo} — Guia de estudo</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<link rel="stylesheet" href="../css/style.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
</head>
<body>
<header class="topo"><div class="topo-in">
  <a class="logo" href="../index.html"><b>∫</b> Matemática Passo a Passo</a>
  <nav class="nav">
    <a href="../index.html#solver">Resolver</a>
    <a href="../index.html#cas">Calculadora CAS</a>
    <a href="index.html" class="ativo">Guias de estudo</a>
  </nav>
</div></header>
<div class="guia">
<aside class="guia-indice">
  <b>{titulo}</b>
{indice}
  <hr><a href="index.html">← Todos os guias</a>
</aside>
<article class="guia-conteudo">
{corpo}
<section><p><a class="btn" href="index.html">← Voltar aos guias</a> <a class="btn sec" href="../index.html#solver">Ir para o solver</a> <a class="btn sec" href="../index.html#cas">Calculadora CAS</a></p></section>
</article>
</div>
<script src="../js/grafico.js"></script>
<script src="widgets.js"></script>
</body>
</html>
"""


def limpa(h):
    h = re.sub(r'<[^>]+>', '', h)
    return h.replace('$', '').strip()


def main():
    for src in sorted((AQUI / 'src').glob('*.html')):
        txt = src.read_text(encoding='utf-8')
        titulo = re.search(r'<!--\s*titulo:\s*(.+?)\s*-->', txt).group(1)
        secs = re.findall(r'<section id="([^"]+)">\s*<h2>(.*?)</h2>', txt, re.S)
        indice = '\n'.join('  <a href="#%s">%s</a>' % (i, limpa(h)) for i, h in secs)
        pagina = MODELO.format(titulo=titulo, indice=indice, corpo=txt)
        (AQUI / src.name).write_text(pagina, encoding='utf-8')
        print('gerado', src.name, len(secs), 'secções')


if __name__ == '__main__':
    main()
