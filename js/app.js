/* Matemática Passo a Passo — lógica da página principal */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let py = null, motor = null;

  // ---------------------------------------------------------------- KaTeX
  function tex(latex, display = false) {
    try { return katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: false }); }
    catch (e) { return `<code>${esc(latex)}</code>`; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderMathIn(el) {
    if (window.renderMathInElement) renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
  }

  // ---------------------------------------------------------------- Motor (Pyodide)
  async function arrancarMotor() {
    const est = $('#estado');
    try {
      py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' });
      est.querySelector('span').textContent = 'A carregar o SymPy…';
      await py.loadPackage(['sympy']);
      py.FS.writeFile('/home/pyodide/engine.py', window.ENGINE_SRC);
      motor = py.pyimport('engine');
      est.classList.add('pronto');
      est.querySelector('span').textContent = 'Motor pronto';
      $('#btn-resolver').disabled = false;
      atualizarPrevia();
      if (pendente) { const p = pendente; pendente = null; p(); }
    } catch (e) {
      est.querySelector('span').textContent = 'Erro a carregar o motor (precisas de internet na 1.ª vez)';
      console.error(e);
    }
  }
  function chamar(fn, ...args) {
    if (!motor) throw new Error('O motor ainda está a carregar.');
    return JSON.parse(motor[fn](...args.map(a => a === undefined || a === null ? '' : String(a))));
  }
  let pendente = null;

  // ---------------------------------------------------------------- Navegação
  function mostrarVista() {
    const h = location.hash.replace('#', '') || 'solver';
    const [nome, query] = h.split('?');
    const vista = ['solver', 'cas', 'definicoes'].includes(nome) ? nome : 'solver';
    $$('.vista').forEach(v => v.classList.toggle('ativa', v.id === 'v-' + vista));
    $$('.nav a[data-vista]').forEach(a => a.classList.toggle('ativo', a.dataset.vista === vista));
    if (vista === 'solver' && query) {
      const p = new URLSearchParams(query);
      const run = () => {
        escolherTipo(p.get('tipo') || 'derivada');
        if (p.get('tipo') === 'gauss') $('#mat').value = (p.get('a') || '').replace(/;/g, '\n'); else $('#expr').value = p.get('a') || '';
        if (p.get('b')) (p.get('tipo') === 'limite' ? $('#ca') : $('#ca')).value = p.get('b');
        if (p.get('c')) $('#cb').value = p.get('c');
        if (p.get('treino')) $('#modo-treino').checked = true;
        history.replaceState(null, '', '#solver');
        resolver();
      };
      if (motor) run(); else pendente = run;
    }
    if (vista === 'cas') setTimeout(() => $('#cas-in').focus(), 50);
  }
  window.addEventListener('hashchange', mostrarVista);

  // ---------------------------------------------------------------- Solver: formulário
  const EXEMPLOS = {
    derivada: ['x^2*sen(x)', 'sen(3x^2+1)', '(x^2+1)/(x-3)', 'ln(cos(x))', 'e^(2x)*cos(x)', 'x^x', 'sqrt(1+x^2)'],
    integral: ['e^x*cos(x)', 'x*sen(x^2)', 'x^2*ln(x)', 'x*e^(2x)', '1/(x^2-1)', '3x^2+2x-5', 'cos(x)^2'],
    limite: [['(x^2-1)/(x-1)', '1'], ['sen(x)/x', '0'], ['(3x^2+1)/(2x^2-x)', 'oo'], ['(1+1/x)^x', 'oo'], ['(e^x-1)/x', '0']],
    equacao: ['x^2-5x+6=0', '2x+3=7', 'x^3-6x^2+11x-6=0', '2^x=8', 'sen(x)=1/2'],
    gauss: ['1 2 1 4; 2 -1 3 9; 3 1 -2 1', '1 1 2; 2 2 5', '1 1 1 3; 2 2 2 6; 1 -1 0 0', '2 1; 4 3'],
  };
  let tipo = 'derivada';
  function escolherTipo(t) {
    tipo = t;
    $$('#tipos button').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === t));
    const mostra = (id, v) => { $(id).hidden = !v; };
    mostra('#c-expr', t !== 'gauss'); mostra('#c-mat', t === 'gauss');
    mostra('#c-var', t !== 'gauss'); mostra('#c-ordem', t === 'derivada');
    mostra('#c-a', t === 'integral' || t === 'limite'); mostra('#c-b', t === 'integral');
    mostra('#c-lado', t === 'limite'); mostra('#c-aum', t === 'gauss');
    $('#l-expr').textContent = t === 'equacao' ? 'Equação' : 'Função';
    $('#l-a').textContent = t === 'limite' ? 'x tende para' : 'Limite inferior (opcional)';
    $('#ca').placeholder = t === 'limite' ? 'ex.: 0, 2, oo, -oo' : 'vazio = primitiva';
    $('#expr').placeholder = t === 'equacao' ? 'ex.: x^2-5x+6=0' : 'ex.: ' + EXEMPLOS[t]?.[0];
    $('#exemplos').innerHTML = 'Exemplos: ' + EXEMPLOS[t].map((e, i) => `<button data-i="${i}">${esc(Array.isArray(e) ? e[0] + '  (x→' + e[1] + ')' : e)}</button>`).join('');
    $$('#exemplos button').forEach(b => b.onclick = () => {
      const e = EXEMPLOS[t][+b.dataset.i];
      if (t === 'gauss') { $('#mat').value = e.replace(/; /g, '\n'); $('#aum').value = e.split(';')[0].trim().split(/\s+/).length > 2 || e.includes('5') ? 'sim' : 'nao'; }
      else if (Array.isArray(e)) { $('#expr').value = e[0]; $('#ca').value = e[1]; }
      else { $('#expr').value = e; $('#ca').value = ''; $('#cb').value = ''; }
      atualizarPrevia(); resolver();
    });
    atualizarPrevia();
  }
  $$('#tipos button').forEach(b => b.onclick = () => escolherTipo(b.dataset.tipo));

  let tPrevia;
  function atualizarPrevia() {
    clearTimeout(tPrevia);
    tPrevia = setTimeout(() => {
      if (!motor || tipo === 'gauss') { $('#previa').innerHTML = ''; return; }
      const v = $('#expr').value.trim();
      if (!v) { $('#previa').innerHTML = ''; return; }
      const r = chamar('previsualizar', v);
      $('#previa').innerHTML = r.latex ? tex(r.latex) : '';
    }, 180);
  }
  $('#expr').addEventListener('input', atualizarPrevia);
  $('#expr').addEventListener('keydown', e => { if (e.key === 'Enter') resolver(); });
  $('#btn-resolver').onclick = () => resolver();

  function dadosAtuais() {
    if (tipo === 'gauss') return [tipo, $('#mat').value, $('#aum').value];
    if (tipo === 'derivada') return [tipo, $('#expr').value, $('#var').value, $('#ordem').value];
    if (tipo === 'integral') return [tipo, $('#expr').value, $('#var').value, $('#ca').value, $('#cb').value];
    if (tipo === 'limite') return [tipo, $('#expr').value, $('#var').value, $('#ca').value || '0', $('#lado').value];
    return [tipo, $('#expr').value, $('#var').value];
  }

  // ---------------------------------------------------------------- Solver: resultado
  let atual = null;       // último resultado
  let revelados = 0;      // passos visíveis no modo "um passo de cada vez"

  function resolver() {
    if (!motor) { pendente = resolver; $('#resultado').innerHTML = '<div class="info">O motor ainda está a carregar… resolvo assim que estiver pronto.</div>'; return; }
    const d = dadosAtuais();
    if (!d[1].trim()) return;
    $('#btn-resolver').disabled = true;
    setTimeout(() => {
      try { atual = chamar('resolver', ...d); }
      catch (e) { atual = { ok: false, erro: String(e) }; }
      atual.dados = d;
      $('#btn-resolver').disabled = false;
      revelados = 0;
      mostrarResultado();
    }, 20);
  }

  function mostrarResultado() {
    const R = $('#resultado');
    if (!atual.ok) { R.innerHTML = `<div class="cartao"><div class="aviso">${esc(atual.erro)}</div></div>`; return; }
    const treino = $('#modo-treino').checked;
    const umPasso = localStorage.getItem('umPasso') === '1';
    R.innerHTML = `
      <div class="cartao">
        <div class="resultado-topo" id="res-topo"></div>
        ${treino ? blocoTreino() : ''}
        <div class="barra-passos">
          <h3>Passos da solução</h3>
          <label class="interruptor"><input type="checkbox" id="um-passo" ${umPasso ? 'checked' : ''}><span class="t"></span> Um passo de cada vez</label>
          <button class="btn sec peq" id="btn-outro">🎲 Dá-me outro igual</button>
        </div>
        <div class="metodos-tabs" id="metodos-tabs"></div>
        <div class="passos" id="passos"></div>
        <div class="controlo-passo" id="controlo-passo"></div>
      </div>
      <div class="cartao" id="cartao-graf" hidden><h3 style="margin-top:0">Gráfico</h3><div id="graf"></div></div>`;
    $('#res-topo').innerHTML = treino ? tex(atual.enunciado, true) : tex(topo(), true);
    $('#um-passo').onchange = e => { localStorage.setItem('umPasso', e.target.checked ? '1' : '0'); revelados = 0; desenharPassos(); };
    $('#btn-outro').onclick = outroIgual;
    if (treino) ligarTreino();
    // métodos alternativos
    const met = atual.metodos || [];
    let passosAtivos = atual.passos;
    if (met.length) {
      const tabs = $('#metodos-tabs');
      const lista = [{ nome: 'Método principal', passos: atual.passos }, ...met.map((m, i) => ({ nome: 'Outro método ' + (i + 1), passos: m.passos }))];
      tabs.innerHTML = lista.map((m, i) => `<button class="btn peq ${i ? 'cinza' : ''}" data-i="${i}">${m.nome}</button>`).join('');
      $$('button', tabs).forEach(b => b.onclick = () => {
        $$('button', tabs).forEach(x => x.classList.add('cinza')); b.classList.remove('cinza');
        passosAtivos = lista[+b.dataset.i].passos; atual._passos = passosAtivos; revelados = 0; desenharPassos();
      });
    }
    atual._passos = passosAtivos;
    desenharPassos();
    desenharGrafico();
  }

  function topo() {
    const t = atual.dados[0];
    return atual.enunciado + (t === 'gauss' || t === 'equacao' ? ' \\;\\Longrightarrow\\; ' : ' = ') + atual.resultado;
  }

  function desenharPassos() {
    const passos = atual._passos || [];
    const um = $('#um-passo').checked || $('#modo-treino').checked;
    const box = $('#passos'); box.innerHTML = '';
    const ate = um ? revelados : passos.length;
    passos.slice(0, ate).forEach((p, i) => box.appendChild(cartaoPasso(p, i)));
    const ctl = $('#controlo-passo'); ctl.innerHTML = '';
    if (um && revelados < passos.length) {
      const prox = passos[revelados];
      ctl.innerHTML = `<button class="btn" id="btn-prox">Mostrar próximo passo (${revelados + 1}/${passos.length})</button>
        <button class="btn sec" id="btn-pista">💡 Pista</button><button class="btn cinza" id="btn-todos">Mostrar todos</button><div id="pista-box" style="width:100%"></div>`;
      $('#btn-prox').onclick = () => { revelados++; desenharPassos(); box.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
      $('#btn-todos').onclick = () => { revelados = passos.length; desenharPassos(); };
      $('#btn-pista').onclick = () => { $('#pista-box').innerHTML = `<div class="pista">💡 ${esc(prox.pista || prox.titulo)}</div>`; renderMathIn($('#pista-box')); };
    } else if (um && passos.length) {
      ctl.innerHTML = `<div class="ok-msg">Resolução completa: ${tex(atual.resultado)}</div>`;
    }
  }

  function formatar(s) {
    // títulos podem ter LaTeX solto (ex.: L_{2} \leftarrow …) — renderiza se tiver "\" ou "_{" ou "^{"
    if (/\\|_\{|\^\{/.test(s) && !/[ãõçéêáíóú]/i.test(s.replace(/\\[a-z]+/g, ''))) return tex(s);
    return esc(s).replace(/(u|w|v) = ([^ ]+)$/, (m) => m);
  }

  function cartaoPasso(p, i) {
    const el = document.createElement('div');
    const destaque = /reapareceu|indetermina/i.test(p.titulo);
    el.className = `passo nivel-${Math.min(p.nivel, 4)}${destaque ? ' destaque' : ''}`;
    const titulo = tituloComMat(p.titulo);
    el.innerHTML = `
      <div class="cab"><span class="n">${i + 1}</span><span class="tit">${titulo}</span><span class="seta">▾</span></div>
      <div class="corpo">${tex(p.latex, true)}</div>
      <div class="porque">
        ${p.porque ? `<div>${esc(p.porque)}</div>` : ''}
        ${p.regra ? `<div class="regra"><b>Regra:</b> ${tex(p.regra)}</div>` : ''}
        <button class="btn sec peq ia-btn">🤖 Não percebi este passo</button>
        <div class="ia-saida"></div>
      </div>`;
    $('.cab', el).onclick = () => el.classList.toggle('aberto');
    $('.ia-btn', el).onclick = () => explicarPasso(p, i, $('.ia-saida', el));
    renderMathIn(el);
    return el;
  }
  function tituloComMat(t) {
    if (t.includes('L_{')) { // títulos do método de Gauss (LaTeX puro)
      t = t.replace(/\$/g, '');
      const m = t.match(/^([^:\\]*:\s*)(.*)$/);
      return m ? esc(m[1]) + tex(m[2]) : tex(t);
    }
    return esc(t); // pode ter $…$ — renderizado por renderMathIn
  }

  // ---------------------------------------------------------------- Gráfico do exercício
  function desenharGrafico() {
    const g = atual.grafico;
    if (!g || !g.curvas || !g.curvas.length) return;
    $('#cartao-graf').hidden = false;
    const gr = new Grafico('#graf', { xmin: g.janela[0], xmax: g.janela[1], altura: 340 });
    g.curvas.forEach(c => gr.amostra(c.pontos.map(([x, y]) => [x, y]), { cor: c.cor, nome: c.nome }));
    if (g.area) {
      const pts = g.curvas[0].pontos;
      const f = x => { // interpolação linear nas amostras
        const h = (g.janela[1] - g.janela[0]) / (pts.length - 1); const i = Math.floor((x - g.janela[0]) / h);
        const p0 = pts[i], p1 = pts[i + 1]; if (!p0 || !p1 || p0[1] === null || p1[1] === null) return 0;
        return p0[1] + (p1[1] - p0[1]) * (x - p0[0]) / h;
      };
      gr.area(f, g.area.a, g.area.b);
      gr.verticais.push({ x: g.area.a, rotulo: 'a' }, { x: g.area.b, rotulo: 'b' });
    }
    gr.desenhar();
  }

  // ---------------------------------------------------------------- Modo treino
  function blocoTreino() {
    return `<div class="treino"><b>Modo treino:</b> resolve no caderno e escreve o resultado final. Se errares, pede uma pista ou vê o próximo passo.
      <div class="linha" style="margin-top:8px"><div class="campo grande"><input id="treino-in" placeholder="${tipo === 'equacao' ? 'ex.: x=2; x=3' : tipo === 'integral' ? 'ex.: x^3/3 (o +C é opcional)' : 'a tua resposta'}"></div>
      <button class="btn" id="treino-ok">Verificar</button><button class="btn cinza" id="treino-ver">Ver solução</button></div>
      <div class="previa" id="treino-previa"></div><div id="treino-msg"></div></div>`;
  }
  function ligarTreino() {
    const inp = $('#treino-in');
    inp.oninput = () => { const r = chamar('previsualizar', inp.value); $('#treino-previa').innerHTML = r.latex ? tex(r.latex) : ''; };
    const verificar = () => {
      const r = chamar('verificar', inp.value);
      $('#treino-msg').innerHTML = !r.ok ? `<span class="erro-msg">${esc(r.erro)}</span>` : r.certo
        ? `<p class="ok-msg">✔ Certo! Muito bem.</p>` : `<p class="erro-msg">✘ Ainda não está certo. Pede uma pista abaixo ou revela o próximo passo.</p>`;
      if (r.certo) { $('#res-topo').innerHTML = tex(topo(), true); }
    };
    $('#treino-ok').onclick = verificar;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') verificar(); });
    $('#treino-ver').onclick = () => { $('#res-topo').innerHTML = tex(topo(), true); revelados = (atual._passos || []).length; desenharPassos(); };
  }
  $('#modo-treino').onchange = () => { if (atual && atual.ok) { revelados = 0; mostrarResultado(); } };

  function outroIgual() {
    const d = atual.dados;
    const r = chamar('parecido', d[0], d[1]);
    if (!r.ok) return;
    if (d[0] === 'gauss') $('#mat').value = r.expressao.replace(/;\s*/g, '\n'); else $('#expr').value = r.expressao;
    atualizarPrevia(); resolver();
  }

  // ---------------------------------------------------------------- IA gratuita (Gemini)
  const chave = () => localStorage.getItem('geminiChave') || '';
  const modelo = () => localStorage.getItem('geminiModelo') || 'gemini-2.5-flash';
  async function gemini(partes, json = false) {
    if (!chave()) throw new Error('SEM_CHAVE');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo())}:generateContent`;
    const corpo = { contents: [{ role: 'user', parts: partes }] };
    if (json) corpo.generationConfig = { responseMimeType: 'application/json', temperature: 0 };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave() }, body: JSON.stringify(corpo) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || ('Erro ' + r.status));
    return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  }
  const semChave = `<div class="aviso">Para usar isto, cria uma chave gratuita em <a href="#definicoes">Definições</a> (2 minutos, sem custo).</div>`;

  async function explicarPasso(p, i, saida) {
    saida.innerHTML = '<div class="ia">A pensar…</div>';
    const ctx = (atual._passos || []).slice(0, i + 1).map((q, k) => `${k + 1}. ${q.titulo}: ${q.latex}`).join('\n');
    const prompt = `És um explicador de matemática paciente para um estudante de engenharia (1.º ano, ISEP, Portugal). Escreve em português de Portugal.
Exercício: ${atual.enunciado}  (resultado: ${atual.resultado})
Passos até agora:\n${ctx}\n
O aluno não percebeu o passo ${i + 1}: "${p.titulo}" → ${p.latex}
Explica SÓ este passo, de forma simples e visual: o que se fez, porquê, e de onde vem cada parte. Usa uma analogia ou imagem mental se ajudar. Máximo 150 palavras. Usa $...$ para matemática em LaTeX. Não refaças o exercício todo.`;
    try {
      const t = await gemini([{ text: prompt }]);
      saida.innerHTML = `<div class="ia">${esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</div>`;
      renderMathIn(saida);
    } catch (e) { saida.innerHTML = e.message === 'SEM_CHAVE' ? semChave : `<div class="aviso">${esc(e.message)}</div>`; }
  }

  // Foto → exercício
  $('#foto-input').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (f) lerFoto(f);
  };
  document.addEventListener('paste', (e) => {
    if (!$('#v-solver').classList.contains('ativa')) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); lerFoto(item.getAsFile()); return; }
    const alvo = e.target;
    // na resposta do modo treino ou noutros campos pequenos, deixa colar normalmente
    if (alvo && alvo.tagName === 'INPUT' && !['expr'].includes(alvo.id)) return;
    if (alvo && alvo.tagName === 'SELECT') return;
    const txt = e.clipboardData?.getData('text/plain');
    if (!txt) return;
    e.preventDefault();
    colarTexto(txt);
  });
  function colarTexto(txt) {
    const r = window.interpretarColado(txt);
    if (!r) return;
    if (r.tipo) escolherTipo(r.tipo);
    if (tipo === 'gauss') { $('#mat').value = r.expr; if (r.aum) $('#aum').value = r.aum; }
    else {
      $('#expr').value = r.expr;
      if (r.var) $('#var').value = r.var;
      if (tipo === 'integral') { $('#ca').value = r.a || ''; $('#cb').value = r.b || ''; }
      if (tipo === 'limite') $('#ca').value = r.a || '0';
    }
    atualizarPrevia();
    $('#foto-zona').innerHTML = `<div class="info" style="margin-top:8px">📋 Colado: <code>${esc(txt.length > 120 ? txt.slice(0, 120) + '…' : txt)}</code> → ${esc({ derivada: 'derivada', integral: 'integral', limite: 'limite', equacao: 'equação', gauss: 'sistema/matriz' }[tipo])}. Se algo ficou mal lido, corrige acima.</div>`;
    resolver();
  }
  $('#btn-colar').onclick = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) colarTexto(t); else alert('A área de transferência está vazia.'); }
    catch (e) { alert('O browser não deixou ler a área de transferência. Usa Cmd+V (Mac) ou Ctrl+V nesta página.'); }
  };
  async function reduzir(file) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  }
  async function lerFoto(file) {
    const zona = $('#foto-zona');
    const url = await reduzir(file);
    zona.innerHTML = `<img class="foto-previa" src="${url}"><div class="info" style="margin-top:8px">A ler o exercício da fotografia…</div>`;
    const prompt = `Lê o exercício de matemática nesta imagem (pode ser manuscrito). Responde APENAS com JSON:
{"tipo": "derivada"|"integral"|"limite"|"equacao"|"gauss"|"outro",
 "expressao": "<expressão na sintaxe de calculadora/SymPy: ^ para potências, * para multiplicar, sin cos tan ln sqrt exp, pi, oo para infinito; para equação inclui '='; para gauss escreve a matriz ampliada com linhas separadas por ';' e números separados por espaços>",
 "variavel": "x", "a": "<limite inferior do integral ou ponto do limite, ou vazio>", "b": "<limite superior do integral, ou vazio>",
 "descricao": "<o que o exercício pede, numa frase em português de Portugal>"}
Se houver várias alíneas, escolhe a primeira. Se for um sistema de equações lineares, usa tipo "gauss".`;
    try {
      const t = await gemini([{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: url.split(',')[1] } }], true);
      const d = JSON.parse(t.replace(/^```json|```$/g, ''));
      if (!['derivada', 'integral', 'limite', 'equacao', 'gauss'].includes(d.tipo)) {
        zona.innerHTML = `<img class="foto-previa" src="${url}"><div class="aviso" style="margin-top:8px">Li: "${esc(d.descricao || d.expressao)}". Este tipo de exercício ainda não é suportado pelo solver — experimenta a Calculadora CAS.</div>`; return;
      }
      escolherTipo(d.tipo);
      if (d.tipo === 'gauss') $('#mat').value = (d.expressao || '').replace(/;\s*/g, '\n'); else $('#expr').value = d.expressao || '';
      $('#var').value = d.variavel || 'x';
      $('#ca').value = d.a || ''; $('#cb').value = d.b || '';
      atualizarPrevia();
      zona.innerHTML = `<img class="foto-previa" src="${url}"><div class="info" style="margin-top:8px">📷 ${esc(d.descricao || '')}<br>Confirma se a expressão acima está bem lida (podes corrigi-la) e carrega em <b>Resolver</b>.</div>`;
    } catch (e) {
      zona.innerHTML = `<img class="foto-previa" src="${url}">` + (e.message === 'SEM_CHAVE' ? semChave : `<div class="aviso">Não consegui ler a foto: ${esc(e.message)}</div>`);
    }
  }

  // ---------------------------------------------------------------- Definições
  $('#def-chave').value = chave();
  $('#def-modelo').value = modelo();
  $('#def-guardar').onclick = () => {
    localStorage.setItem('geminiChave', $('#def-chave').value.trim());
    localStorage.setItem('geminiModelo', $('#def-modelo').value.trim() || 'gemini-2.5-flash');
    $('#def-msg').innerHTML = '<span class="ok-msg">Guardado neste browser.</span>';
  };
  $('#def-testar').onclick = async () => {
    $('#def-guardar').click();
    $('#def-msg').textContent = 'A testar…';
    try { const t = await gemini([{ text: 'Responde só: OK' }]); $('#def-msg').innerHTML = `<span class="ok-msg">Ligação a funcionar (${esc(t.trim().slice(0, 20))}).</span>`; }
    catch (e) { $('#def-msg').innerHTML = `<span class="erro-msg">${esc(e.message === 'SEM_CHAVE' ? 'Falta a chave.' : e.message)}</span>`; }
  };

  // ---------------------------------------------------------------- Calculadora CAS (estilo TI-Nspire)
  // '|' marca onde fica o cursor depois de inserir
  const MENU = [
    ['Ações', [
      ['Definir variável', 'a:=|', ':='], ['Definir função', 'f(x):=|', 'f(x):='], ['Apagar variáveis', '@limpar_vars'], ['Limpar histórico', '@limpar_hist']]],
    ['Número', [
      ['Converter em decimal', 'approx(|)', 'approx'], ['Aproximar a fração', 'exact(|)', 'exact'], ['Fatorizar (números primos)', 'factor(|)', 'factor'],
      ['Mínimo múltiplo comum', 'lcm(|,)', 'lcm'], ['Máximo divisor comum', 'gcd(|,)', 'gcd'], ['Resto da divisão', 'mod(|,)', 'mod'],
      ['Ferramentas de números', [['Arredondar', 'round(|,2)', 'round'], ['Parte inteira (floor)', 'floor(|)', 'floor'], ['Teto (ceiling)', 'ceiling(|)', 'ceiling'], ['Valor absoluto', 'abs(|)', 'abs'], ['Sinal', 'sign(|)', 'sign']]],
      ['Números complexos', [['Conjugado', 'conj(|)', 'conj'], ['Parte real', 'real(|)', 'real'], ['Parte imaginária', 'imag(|)', 'imag'], ['Argumento (ângulo)', 'angle(|)', 'angle'], ['Módulo', 'abs(|)', 'abs'], ['Forma polar (módulo, arg.)', 'polar(|)', 'polar']]]]],
    ['Álgebra', [
      ['Resolver', 'solve(|,x)', 'solve'], ['Fatorizar', 'factor(|)', 'factor'], ['Expandir', 'expand(|)', 'expand'], ['Zeros', 'zeros(|,x)', 'zeros'],
      ['Resolução numérica', 'nSolve(|,x)', 'nSolve'], ['Sistema de equações', 'solve(| and ,{x,y})', 'solve … and …'],
      ['Denominador comum', 'comDenom(|)', 'comDenom'], ['Frações simples', 'expand(|,x)', 'expand(f,x)'],
      ['Trigonometria', [['Expandir trigonométrica', 'tExpand(|)', 'tExpand'], ['Agrupar trigonométrica', 'tCollect(|)', 'tCollect']]]]],
    ['Cálculo', [
      ['Derivada', 'derivative(|,x)', 'derivative'], ['Derivada num ponto', 'derivPt(|,x,)', 'derivPt'], ['Integral', 'integral(|,x)', 'integral'],
      ['Integral definido', 'integral(|,x,a,b)', 'integral(f,x,a,b)'], ['Limite', 'limit(|,x,0)', 'limit'], ['Limite lateral', 'limit(|,x,0,"+")', 'limit(…,"+")'],
      ['Soma (Σ)', 'sum(|,k,1,n)', 'sum'], ['Produto (Π)', 'product(|,k,1,n)', 'product'], ['Mínimo da função', 'fMin(|,x)', 'fMin'], ['Máximo da função', 'fMax(|,x)', 'fMax'],
      ['Reta tangente', 'tangentLine(|,x,)', 'tangentLine'], ['Reta normal', 'normalLine(|,x,)', 'normalLine'], ['Série de Taylor', 'taylor(|,x,5)', 'taylor'],
      ['Equação diferencial', "deSolve(y'=| and y(0)=1,x,y)", 'deSolve'], ['Transformada de Laplace', 'laplace(|)', 'laplace'], ['Laplace inversa', 'ilaplace(|)', 'ilaplace']]],
    ['Probabilidade', [['Fatorial', '|!', '!'], ['Permutações', 'nPr(|,)', 'nPr'], ['Combinações', 'nCr(|,)', 'nCr']]],
    ['Estatística', [['Média', 'mean({|})', 'mean'], ['Mediana', 'median({|})', 'median'], ['Desvio-padrão amostral', 'stDevSamp({|})', 'stDevSamp'], ['Variância amostral', 'varSamp({|})', 'varSamp']]],
    ['Matriz e vetor', [
      ['Criar matriz 2×2', '[[|,],[,]]', '[[a,b],[c,d]]'], ['Criar matriz 3×3', '[[|,,],[,,],[,,]]', '[[…],[…],[…]]'], ['Transposta', 'transposta(|)', 'transposta'],
      ['Determinante', 'det(|)', 'det'], ['Inversa', '(|)^-1', 'A^-1'], ['Forma em escada (ref)', 'ref(|)', 'ref'], ['Forma em escada reduzida (rref)', 'rref(|)', 'rref'],
      ['Matriz identidade', 'identity(|)', 'identity'], ['Valores próprios', 'eigVl(|)', 'eigVl'], ['Vetores próprios', 'eigVc(|)', 'eigVc'], ['Característica', 'car(|)', 'car'],
      ['Resolver sistema A·X = B', 'simult(|,)', 'simult'],
      ['Vetor', [['Produto escalar', 'dotP(|,)', 'dotP'], ['Produto vetorial', 'crossP(|,)', 'crossP'], ['Norma', 'norm(|)', 'norm']]]]],
  ];
  const TRIG = [['sin', 'sin(|)'], ['cos', 'cos(|)'], ['tan', 'tan(|)'], ['sin⁻¹', 'asin(|)'], ['cos⁻¹', 'acos(|)'], ['tan⁻¹', 'atan(|)'], ['sinh', 'sinh(|)'], ['cosh', 'cosh(|)'], ['tanh', 'tanh(|)']];
  const MODELOS = [
    ['Fração', '(|)/()'], ['Potência', '(|)^()'], ['Raiz quadrada', 'sqrt(|)'], ['Raiz de índice n', 'root(|,n)'], ['Exponencial', 'e^(|)'], ['Logaritmo de base b', 'log(|,b)'],
    ['Derivada', 'derivative(|,x)'], ['Integral indefinido', 'integral(|,x)'], ['Integral definido', 'integral(|,x,a,b)'], ['Limite', 'limit(|,x,a)'], ['Soma Σ', 'sum(|,k,1,n)'],
    ['Matriz 2×2', '[[|,],[,]]'], ['Sistema de 2 equações', 'solve(| and ,{x,y})'], ['Módulo |x|', 'abs(|)'], ['Função por ramos', 'Piecewise((|, x<0), (x^2, True))'],
  ];
  // teclado: [rótulo, ação, classe, legenda]
  const TECLADO = [
    [['menu', '@menu', 'azul'], ['var', '@var', 'claro'], ['trig', '@trig', 'claro'], ['⊞ modelos', '@modelos', 'claro'], ['⌫ del', '@del', 'vermelho'], ['clear', '@clear', 'vermelho']],
    [['◀', '@esq', ''], ['▶', '@dir', ''], ['↑ hist.', '@cima', ''], ['ans', 'ans', ''], ['=', '=', ''], [':=', ':=', '']],
    [['x²', '^2', ''], ['^', '^', ''], ['√', 'sqrt(|)', ''], ['eˣ', 'e^(|)', ''], ['ln', 'ln(|)', ''], ['log', 'log(|)', '', 'base 10']],
    [['(', '(', ''], [')', ')', ''], [',', ',', ''], ['{ }', '{|}', ''], ['[ ]', '[|]', ''], ['!', '!', '']],
    [['x', 'x', 'claro'], ['y', 'y', 'claro'], ['z', 'z', 'claro'], ['π', 'pi', 'claro'], ['i', 'i', 'claro', 'complexo'], ['∞', 'oo', 'claro']],
    ['sep'],
    [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['÷', '/', 'op'], ['and', ' and ', 'claro']],
    [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['×', '*', 'op'], ['<', '<', 'claro']],
    [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['−', '-', 'op'], ['>', '>', 'claro']],
    [['0', '0', 'num'], ['.', '.', 'num'], ['(−)', '-', 'num'], ['+', '+', 'op'], ['enter', '@enter', 'enter']],
  ];
  const inpCas = $('#cas-in');
  function inserir(modelo) {
    const s = inpCas.selectionStart ?? inpCas.value.length, e = inpCas.selectionEnd ?? s;
    let txt = modelo, pos = modelo.indexOf('|');
    const selecionado = inpCas.value.slice(s, e);
    if (pos >= 0) txt = modelo.replace('|', selecionado); else pos = txt.length;
    inpCas.value = inpCas.value.slice(0, s) + txt + inpCas.value.slice(e);
    inpCas.focus();
    const c = s + (modelo.includes('|') ? pos + selecionado.length : txt.length);
    inpCas.selectionStart = inpCas.selectionEnd = c;
  }
  function tecla(acao) {
    if (acao === '@menu') return abrirMenu();
    if (acao === '@trig') return abrirLista('trig', TRIG.map(([n, m]) => [n, m, m.replace('|', '…')]));
    if (acao === '@modelos') return abrirLista('Modelos', MODELOS.map(([n, m]) => [n, m, m.replace('|', '…')]));
    if (acao === '@var') return abrirVars();
    if (acao === '@enter') return calcCas();
    if (acao === '@clear') { inpCas.value = ''; return inpCas.focus(); }
    if (acao === '@del') {
      const s = inpCas.selectionStart, e = inpCas.selectionEnd;
      if (s !== e) inpCas.value = inpCas.value.slice(0, s) + inpCas.value.slice(e);
      else if (s > 0) { inpCas.value = inpCas.value.slice(0, s - 1) + inpCas.value.slice(s); inpCas.selectionStart = inpCas.selectionEnd = s - 1; }
      return inpCas.focus();
    }
    if (acao === '@esq' || acao === '@dir') { const p = Math.max(0, inpCas.selectionStart + (acao === '@esq' ? -1 : 1)); inpCas.focus(); inpCas.selectionStart = inpCas.selectionEnd = p; return; }
    if (acao === '@cima') { if (iHist > 0) { iHist--; inpCas.value = histCas[iHist]; } return inpCas.focus(); }
    inserir(acao);
  }
  $('#ti-teclado').innerHTML = TECLADO.map(l => l[0] === 'sep' ? '<div class="ti-sep"></div>' :
    `<div class="ti-linha" style="grid-template-columns:repeat(${l.length},1fr)">` + l.map(([r, a, c, leg]) =>
      `<button class="ti-tecla ${c}" data-a="${esc(a)}">${esc(r)}${leg ? `<small>${esc(leg)}</small>` : ''}</button>`).join('') + '</div>').join('');
  $$('#ti-teclado .ti-tecla').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => tecla(b.dataset.a); });

  // menus
  const pop = $('#ti-pop');
  const fecharPop = () => { pop.hidden = true; pop.innerHTML = ''; inpCas.focus(); };
  pop.onclick = e => { if (e.target === pop) fecharPop(); };
  const tecla36 = i => i < 9 ? String(i + 1) : String.fromCharCode(65 + i - 9);
  function abrirLista(titulo, itens, voltar) {
    pop.hidden = false;
    pop.innerHTML = `<div class="ti-menu"><div class="ti-menu-cab">${voltar ? '<button class="voltar">◀</button>' : ''}<span>${esc(titulo)}</span><button class="fechar">✕</button></div>` +
      itens.map((it, i) => `<div class="ti-item" tabindex="0" data-i="${i}"><span class="k">${tecla36(i)}</span><span class="nm">${esc(it[0])}${Array.isArray(it[1]) ? ' <span class="sub">▸</span>' : ''}</span>${it[2] ? `<code>${esc(it[2])}</code>` : ''}</div>`).join('') + '</div>';
    $('.fechar', pop).onclick = fecharPop;
    if (voltar) $('.voltar', pop).onclick = voltar;
    const escolher = i => {
      const it = itens[i]; if (!it) return;
      if (Array.isArray(it[1])) return abrirLista(titulo + ' › ' + it[0], it[1], () => abrirLista(titulo, itens, voltar));
      fecharPop();
      if (it[1] === '@limpar_vars') { chamar('cas_limpar'); return; }
      if (it[1] === '@limpar_hist') { $('#cas-ecra').innerHTML = ''; return; }
      inserir(it[1]);
    };
    $$('.ti-item', pop).forEach(el => el.onclick = () => escolher(+el.dataset.i));
    pop.onkeydown = e => {
      if (e.key === 'Escape') return fecharPop();
      const k = e.key.toUpperCase(); const i = /^[1-9]$/.test(k) ? +k - 1 : /^[A-Z]$/.test(k) ? k.charCodeAt(0) - 56 : -1;
      if (i >= 0) { e.preventDefault(); escolher(i); }
      if (e.key === 'Enter' && document.activeElement.dataset.i) { e.preventDefault(); escolher(+document.activeElement.dataset.i); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const it = $$('.ti-item', pop); const j = it.indexOf(document.activeElement); it[(j + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length]?.focus(); }
    };
    $('.ti-item', pop)?.focus();
  }
  function abrirMenu() { abrirLista('menu', MENU.map(([n, sub]) => [n, sub])); }
  function abrirVars() {
    if (!motor) return;
    const r = chamar('cas_vars');
    const itens = r.vars.map(v => [v.nome, v.nome, '']);
    if (!itens.length) itens.push(['(ainda não há variáveis — usa := para guardar)', '', '']);
    abrirLista('var — variáveis guardadas', itens);
  }

  const CMDS = [
    ['solve(x^2=4,x)', 'resolver equação → x = −2 ou x = 2'], ['solve(x+y=3 and x-y=1,{x,y})', 'sistema'], ['zeros(x^3-x,x)', 'zeros → {−1, 0, 1}'],
    ['factor(x^2-5x+6)', 'fatorizar (factor(120) dá os fatores primos)'], ['expand((x+1)^3)', 'desenvolver; expand(f,x) = frações simples'],
    ['derivative(x^3*sin(x),x)', 'derivada'], ['integral(x*e^x,x)', 'primitiva'], ['integral(x^2,x,0,1)', 'integral definido'], ['limit(sin(x)/x,x,0)', 'limite'],
    ['sum(1/k^2,k,1,oo)', 'somatório'], ['taylor(cos(x),x,6)', 'Taylor até ordem 6'], ["deSolve(y''+y=0 and y(0)=1 and y'(0)=0,x,y)", 'equação diferencial'],
    ['A:=[[1,2],[3,4]]', 'guardar matriz'], ['det(A)', 'determinante'], ['A^-1', 'inversa'], ['rref(A)', 'escalonar'], ['eigVl(A)', 'valores próprios'],
    ['f(x):=x^2+1', 'definir função; depois f(3)'], ['nCr(5,2)', 'combinações'], ['mean({1,2,3,4})', 'média'], ['approx(pi)', 'valor decimal'],
    ['laplace(exp(-2t))', 'transformada de Laplace'], ['(3+4i)*(1-2i)', 'complexos'],
  ];
  $('#cmds').innerHTML = '<p class="ajuda">Clica num exemplo para o pôr na linha de entrada. No site <code>log</code> é de base 10 (como na TI) e <code>ln</code> é o natural. Os nomes em português também funcionam (<code>resolver</code>, <code>derivar</code>, <code>integrar</code>…).</p>' +
    CMDS.map(([c, d]) => `<div><code>${esc(c)}</code> — ${esc(d)}</div>`).join('');
  $$('#cmds code').forEach(c => c.onclick = () => { inpCas.value = c.textContent; inpCas.focus(); });

  const histCas = []; let iHist = 0;
  function calcCas() {
    const linha = inpCas.value.trim(); if (!linha) return;
    if (!motor) { alert('O motor ainda está a carregar.'); return; }
    histCas.push(linha); iHist = histCas.length;
    $('.ti-vazio')?.remove();
    const r = chamar('cas', linha);
    const el = document.createElement('div');
    el.className = 'cas-linha' + (r.ok ? '' : ' erro');
    el.innerHTML = `<div class="ent">${esc(linha)}</div>` + (r.ok
      ? `<div class="sai" title="clica para copiar o resultado para a linha de entrada">${tex(r.saida, true)}</div>${r.aprox ? `<div class="apx">≈ ${tex(r.aprox)}</div>` : ''}${r.sugestao ? '<div class="acoes"><button class="btn sec peq">Ver passos</button></div>' : ''}`
      : `<div class="sai">${esc(r.erro)}</div>`);
    if (r.ok && r.sugestao) $('button', el).onclick = () => abrirNoSolver(r.sugestao);
    if (r.ok && r.texto) $('.sai', el).onclick = () => inserir(r.texto);
    $('#cas-ecra').appendChild(el); $('#cas-ecra').scrollTop = 1e9;
    inpCas.value = '';
  }
  function abrirNoSolver(s) {
    const a = s.args;
    const q = new URLSearchParams({ tipo: s.tipo, a: s.tipo === 'equacao' ? a[0] : a[0] || '' });
    if (s.tipo === 'integral' && a.length >= 4) { q.set('b', a[2]); q.set('c', a[3]); }
    if (s.tipo === 'limite' && a.length >= 3) q.set('b', a[2]);
    location.hash = 'solver?' + q.toString();
  }
  inpCas.addEventListener('keydown', e => {
    if (e.key === 'Enter') calcCas();
    if (e.key === 'ArrowUp' && iHist > 0) { iHist--; e.target.value = histCas[iHist]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { iHist = Math.min(histCas.length, iHist + 1); e.target.value = histCas[iHist] || ''; }
  });

  // ---------------------------------------------------------------- Arranque
  document.addEventListener('DOMContentLoaded', () => {
    escolherTipo('derivada');
    mostrarVista();
    arrancarMotor();
  });
})();
