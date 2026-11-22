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
      $('#cas-ok').disabled = false;
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
    if (item) { e.preventDefault(); lerFoto(item.getAsFile()); }
  });
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

  // ---------------------------------------------------------------- Calculadora CAS
  const CMDS = [
    ['derivar(f, x)', 'derivada (derivar(f, x, 2) = 2.ª ordem)'], ['integrar(f, x)', 'primitiva'], ['integrar(f, x, 0, 1)', 'integral definido'],
    ['limite(f, x, 0)', 'limite (oo = ∞; limite(f,x,0,"+") lateral)'], ['resolver(x^2-4, x)', 'resolver equação = 0'], ['2x+3=7', 'resolver equação'],
    ['resolver([x+y-3, x-y-1], [x, y])', 'sistema'], ['fatorizar(f)', 'fatorizar'], ['expandir(f)', 'desenvolver'], ['simplificar(f)', 'simplificar'],
    ['fracoes(f)', 'frações simples'], ['taylor(f, x, 0, 6)', 'polinómio de Taylor'], ['somatorio(1/k^2, (k, 1, oo))', 'somatório'],
    ['A := Matrix([[1,2],[3,4]])', 'guardar matriz'], ['det(A)', 'determinante'], ['inv(A)', 'inversa'], ['transposta(A)', 'transposta'],
    ['car(A)', 'característica'], ['valoresproprios(A)', 'valores próprios'], ['A*B', 'produto de matrizes'],
    ['laplace(exp(-2t))', 'transformada de Laplace'], ['ilaplace(1/(s+2))', 'Laplace inversa'],
    ['edo("y\'\' + y = 0")', 'equação diferencial'], ['edo("y\' = 2y", "y(0)=1")', 'EDO com condição inicial'],
    ['(3+4i)*(1-2i)', 'complexos'], ['polar(1+i)', 'módulo e argumento'], ['numerico(pi, 20)', 'valor aproximado'],
  ];
  $('#cmds').innerHTML = CMDS.map(([c, d]) => `<div><code>${esc(c)}</code> — ${esc(d)}</div>`).join('');
  $$('#cmds code').forEach(c => c.onclick = () => { $('#cas-in').value = c.textContent; $('#cas-in').focus(); });
  const TECLAS = ['^', '*', '/', '(', ')', 'sqrt(', 'pi', 'e', 'i', 'oo', 'sen(', 'cos(', 'tg(', 'ln(', 'derivar(', 'integrar(', 'limite(', 'resolver(', ':='];
  $('#teclado').innerHTML = TECLAS.map(t => `<button>${esc(t)}</button>`).join('');
  $$('#teclado button').forEach(b => b.onclick = () => {
    const inp = $('#cas-in'), s = inp.selectionStart, e = inp.selectionEnd;
    inp.value = inp.value.slice(0, s) + b.textContent + inp.value.slice(e);
    inp.focus(); inp.selectionStart = inp.selectionEnd = s + b.textContent.length;
  });
  const histCas = []; let iHist = 0;
  function calcCas() {
    const inp = $('#cas-in'); const linha = inp.value.trim(); if (!linha) return;
    if (!motor) { alert('O motor ainda está a carregar.'); return; }
    histCas.push(linha); iHist = histCas.length;
    const r = chamar('cas', linha);
    const el = document.createElement('div');
    el.className = 'cas-linha' + (r.ok ? '' : ' erro');
    el.innerHTML = `<div class="ent">${esc(linha)}</div>` + (r.ok
      ? `<div class="sai">${tex(r.saida, true)}</div>${r.aprox ? `<div class="apx">≈ ${tex(r.aprox)}</div>` : ''}${r.sugestao ? '<div class="acoes"><button class="btn sec peq">Ver passos</button></div>' : ''}`
      : `<div class="sai">${esc(r.erro)}</div>`);
    if (r.ok && r.sugestao) $('button', el).onclick = () => abrirNoSolver(r.sugestao);
    $('#cas-ecra').appendChild(el); $('#cas-ecra').scrollTop = 1e9;
    inp.value = '';
  }
  function abrirNoSolver(s) {
    const a = s.args;
    const q = new URLSearchParams({ tipo: s.tipo, a: a[0] || '' });
    if (s.tipo === 'integral' && a.length >= 4) { q.set('b', a[2]); q.set('c', a[3]); }
    if (s.tipo === 'limite' && a.length >= 3) q.set('b', a[2]);
    location.hash = 'solver?' + q.toString();
  }
  $('#cas-ok').onclick = calcCas;
  $('#cas-in').addEventListener('keydown', e => {
    if (e.key === 'Enter') calcCas();
    if (e.key === 'ArrowUp' && iHist > 0) { iHist--; e.target.value = histCas[iHist]; e.preventDefault(); }
    if (e.key === 'ArrowDown') { iHist = Math.min(histCas.length, iHist + 1); e.target.value = histCas[iHist] || ''; }
  });
  $('#cas-limpar').onclick = () => { $('#cas-ecra').innerHTML = ''; if (motor) chamar('cas_limpar'); };

  // ---------------------------------------------------------------- Arranque
  document.addEventListener('DOMContentLoaded', () => {
    escolherTipo('derivada');
    mostrarVista();
    arrancarMotor();
  });
})();
