"""Gera js/engine_src.js a partir de py/engine.py (para o site funcionar também aberto como ficheiro)."""
import json, pathlib
src = pathlib.Path('py/engine.py').read_text(encoding='utf-8')
pathlib.Path('js/engine_src.js').write_text('// Gerado por build.py — não editar à mão. Fonte: py/engine.py\nwindow.ENGINE_SRC = ' + json.dumps(src) + ';\n', encoding='utf-8')
print('ok', len(src))
