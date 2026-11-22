/* Gráficos interativos declarativos para os guias.
   Uso: <div class="gw" data-f="x^2-a|f(x)" data-sliders="a:-3:3:0.5:1" data-x="-5,5" data-y="-4,6"></div>
   Tipos (data-tipo): funcao (padrão) · circulo · sucessao · vetores · campo · riemann
   Ver comentários de cada tipo abaixo. */
(() => {
  const fmt = (v, d = 2) => (!isFinite(v) ? (v > 0 ? '+∞' : '−∞') : (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(d)).toString().replace('.', ','));
  const tex = (s, d = false) => { try { return katex.renderToString(s, { displayMode: d, throwOnError: false }); } catch (e) { return s; } };
  const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  // ajudas disponíveis dentro das expressões
  const AJUDA = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, sen: Math.sin, tg: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    arcsen: Math.asin, arccos: Math.acos, arctg: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, max: Math.max, min: Math.min, pi: Math.PI, e: Math.E, fact,
    pw: (c, a, b) => (c ? a : b), // por ramos: pw(x<0, x+1, x^2)
    tsin: (x, n) => { let s = 0; for (let k = 0; 2 * k + 1 <= n; k++) s += (-1) ** k * x ** (2 * k + 1) / fact(2 * k + 1); return s; },
    tcos: (x, n) => { let s = 0; for (let k = 0; 2 * k <= n; k++) s += (-1) ** k * x ** (2 * k) / fact(2 * k); return s; },
    texp: (x, n) => { let s = 0; for (let k = 0; k <= n; k++) s += x ** k / fact(k); return s; },
    tln1: (x, n) => { let s = 0; for (let k = 1; k <= n; k++) s += (-1) ** (k + 1) * x ** k / k; return s; },
    tgeo: (x, n) => { let s = 0; for (let k = 0; k <= n; k++) s += x ** k; return s; },
  };
  const NOMES = Object.keys(AJUDA);
  // converte "3x^2 + 2sin(x)" em JS
  function paraJS(src) {
    let s = src.replace(/\^/g, '**').replace(/π/g, 'pi');
    s = s.replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2').replace(/\)\s*([a-zA-Z0-9(])/g, ')*$1');
    // em JS "-x**2" é erro de sintaxe: passa a "-(x**2)"
    s = s.replace(/(^|[(,=+\-*/<>?:]\s*)-\s*((?:[\w.]+|\([^()]*\))(?:\([^()]*\))?\*\*(?:[\w.]+|\([^()]*\)))/g, '$1-($2)');
    return s;
  }
  function compilar(src, vars) {
    // eslint-disable-next-line no-new-func
    return new Function(...NOMES, ...vars, 'return (' + paraJS(src) + ');').bind(null, ...NOMES.map(n => AJUDA[n]));
  }
  const CORES = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

  function criarSliders(el, spec, aoMudar) {
    const P = {};
    if (!spec) return P;
    const box = document.createElement('div'); box.className = 'controlos';
    spec.split(';').map(t => t.trim()).filter(Boolean).forEach(t => {
      const [nome, min, max, passo, val, rot] = t.split(':');
      P[nome] = +val;
      const lab = document.createElement('label');
      lab.innerHTML = `${rot || nome} <input type="range" min="${min}" max="${max}" step="${passo}" value="${val}"><output>${fmt(+val)}</output>`;
      const inp = lab.querySelector('input'), out = lab.querySelector('output');
      inp.oninput = () => { P[nome] = +inp.value; out.textContent = fmt(+inp.value); aoMudar(); };
      box.appendChild(lab);
    });
    el.before(box);
    return P;
  }
  function formulaViva(el, P) {
    const tpl = el.dataset.formula; if (!tpl) return () => {};
    const d = document.createElement('div'); d.className = 'formula-viva'; el.before(d);
    return () => {
      let s = tpl.replace(/\{(\w+)\}/g, (m, k) => (k in P ? numTex(P[k]) : m));
      s = s.replace(/\+\s*-/g, '-').replace(/-\s*-/g, '+');
      d.innerHTML = tex(s);
    };
  }
  const numTex = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2)));
  function leitura(el) { const d = document.createElement('div'); d.className = 'leitura'; el.after(d); return d; }
  const intervalo = (s, def) => (s ? s.split(',').map(Number) : def);

  // ------------------------------------------------------------------ funcao
  // data-f="expr|nome|cor|tracejado;…"  data-sliders  data-formula  data-tangente="0"  data-area="0:a:b"
  // data-pontos="x,y,rótulo;…"  data-sinal="0"  data-ler="0" (mostra f(x) ao passar o rato)  data-assintotas="x=1;y=0"
  function funcao(el) {
    const P = criarSliders(el, el.dataset.sliders, () => g.desenhar());
    const viva = formulaViva(el, P);
    const [xmin, xmax] = intervalo(el.dataset.x, [-6, 6]);
    const yy = intervalo(el.dataset.y, null);
    const nomesP = Object.keys(P);
    const fs = (el.dataset.f || '').split(';').map(t => t.trim()).filter(Boolean).map((t, i) => {
      const [expr, nome, cor, estilo] = t.split('|');
      const fn = compilar(expr, ['x', ...nomesP]);
      return { f: x => fn(x, ...nomesP.map(n => P[n])), nome, cor: cor || CORES[i % CORES.length], tracejado: estilo === 'tracejado' };
    });
    const ler = el.dataset.ler !== undefined || el.dataset.tangente !== undefined;
    const L = ler ? leitura(el) : null;
    const g = new Grafico(el, {
      xmin, xmax, ymin: yy ? yy[0] : null, ymax: yy ? yy[1] : null, altura: +el.dataset.altura || 320,
      proporcional: el.dataset.proporcional !== undefined, ratoVertical: ler,
      aoMover: x => { g._mx = x; },
      depois: (c, G) => {
        // tangente
        if (el.dataset.tangente !== undefined && G._mx != null) {
          const f = fs[+el.dataset.tangente].f, x0 = G._mx, h = 1e-5, m = (f(x0 + h) - f(x0 - h)) / (2 * h), y0 = f(x0);
          if (isFinite(m) && isFinite(y0)) {
            c.save(); c.strokeStyle = '#ea580c'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(G.x2px(G.X0), G.y2py(y0 + m * (G.X0 - x0))); c.lineTo(G.x2px(G.X1), G.y2py(y0 + m * (G.X1 - x0))); c.stroke();
            c.fillStyle = '#ea580c'; c.beginPath(); c.arc(G.x2px(x0), G.y2py(y0), 5, 0, 7); c.fill(); c.restore();
            L.innerHTML = `x = ${fmt(x0)} · f(x) = ${fmt(y0)} · <b style="color:#ea580c">declive da tangente f'(x) ≈ ${fmt(m)}</b>`;
          }
        } else if (ler && G._mx != null) {
          L.innerHTML = fs.map((q, i) => `${q.nome || 'f'}(${fmt(G._mx)}) = ${fmt(q.f(G._mx))}`).join(' · ');
        }
      },
    });
    g.desenharBase = g.desenhar.bind(g);
    g.desenhar = () => {
      g.limpar(); viva();
      fs.forEach(q => g.funcao(q.f, { cor: q.cor, nome: q.nome, tracejado: q.tracejado }));
      if (el.dataset.area) {
        const [i, a, b, j] = el.dataset.area.split(':');
        const A = a in P ? P[a] : +a, B = b in P ? P[b] : +b;
        g.area(fs[+i].f, A, B, 'rgba(37,99,235,.18)', j !== undefined ? fs[+j].f : null);
        if (j === undefined) g.verticais.push({ x: A, rotulo: 'a' }, { x: B, rotulo: 'b' });
      }
      if (el.dataset.sinal !== undefined) g.sinal = { f: fs[+el.dataset.sinal || 0].f };
      (el.dataset.pontos || '').split(';').filter(Boolean).forEach(t => {
        const [px, py, rot, vazio] = t.split(',');
        const X = px in P ? P[px] : compilar(px, nomesP)(...nomesP.map(n => P[n]));
        const Y = py in P ? P[py] : compilar(py, nomesP)(...nomesP.map(n => P[n]));
        g.ponto(X, Y, { cor: '#111827', rotulo: rot, vazio: vazio === 'v' });
      });
      (el.dataset.assintotas || '').split(';').filter(Boolean).forEach(t => {
        const [eixo, v] = t.split('='); const val = compilar(v, nomesP)(...nomesP.map(n => P[n]));
        (eixo.trim() === 'x' ? g.verticais : g.horizontais).push(eixo.trim() === 'x' ? { x: val, cor: '#9ca3af', rotulo: 'x = ' + fmt(val) } : { y: val, cor: '#9ca3af', rotulo: 'y = ' + fmt(val) });
      });
      g.desenharBase();
    };
    g.desenhar();
  }

  // ------------------------------------------------------------------ riemann
  // data-f="expr" data-a data-b ; slider n
  function riemann(el) {
    const fn = compilar(el.dataset.f, ['x']), a = +el.dataset.a, b = +el.dataset.b;
    const P = criarSliders(el, 'n:1:60:1:4:n (retângulos); m:0:2:1:0:tipo (0 esq · 1 meio · 2 dir)', () => g.desenhar());
    const L = leitura(el);
    const exato = (() => { let s = 0, N = 20000, h = (b - a) / N; for (let i = 0; i < N; i++) s += fn(a + (i + .5) * h) * h; return s; })();
    const [xmin, xmax] = intervalo(el.dataset.x, [a - 1, b + 1]); const yy = intervalo(el.dataset.y, null);
    const g = new Grafico(el, { xmin, xmax, ymin: yy ? yy[0] : null, ymax: yy ? yy[1] : null, altura: 320,
      depois: (c, G) => {
        const n = P.n, h = (b - a) / n; let soma = 0;
        for (let i = 0; i < n; i++) {
          const xi = a + i * h, xs = xi + h * (P.m / 2), yv = fn(xs); soma += yv * h;
          c.fillStyle = yv >= 0 ? 'rgba(37,99,235,.22)' : 'rgba(220,38,38,.22)'; c.strokeStyle = 'rgba(37,99,235,.8)';
          const X = G.x2px(xi), W = G.x2px(xi + h) - X, Y = G.y2py(Math.max(yv, 0)), H = Math.abs(G.y2py(yv) - G.y2py(0));
          c.fillRect(X, Y, W, H); c.strokeRect(X, Y, W, H);
        }
        L.innerHTML = `Soma dos ${n} retângulos ≈ <b>${fmt(soma, 4)}</b> · valor exato do integral ≈ <b>${fmt(exato, 4)}</b> · erro ≈ ${fmt(Math.abs(soma - exato), 4)}`;
      } });
    g.funcao(fn, { cor: '#111827' }); g.desenhar();
  }

  // ------------------------------------------------------------------ círculo trigonométrico
  function circulo(el) {
    const P = criarSliders(el, 't:0:360:15:30:ângulo θ (graus)', () => g.desenhar());
    const L = leitura(el);
    const NOT = { 0: ['1', '0', '0'], 30: ['\\frac{\\sqrt3}{2}', '\\frac12', '\\frac{\\sqrt3}{3}'], 45: ['\\frac{\\sqrt2}{2}', '\\frac{\\sqrt2}{2}', '1'], 60: ['\\frac12', '\\frac{\\sqrt3}{2}', '\\sqrt3'], 90: ['0', '1', '\\text{não existe}'] };
    const g = new Grafico(el, { xmin: -1.8, xmax: 1.8, ymin: -1.4, ymax: 1.4, altura: 360, proporcional: true,
      depois: (c, G) => {
        const th = P.t * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
        c.save(); c.lineWidth = 2;
        c.strokeStyle = '#9ca3af'; c.beginPath(); c.arc(G.x2px(0), G.y2py(0), G.x2px(1) - G.x2px(0), 0, 7); c.stroke();
        c.strokeStyle = '#f59e0b'; c.beginPath(); c.arc(G.x2px(0), G.y2py(0), 22, 0, -th, th > 0); c.stroke();
        c.strokeStyle = '#111827'; c.beginPath(); c.moveTo(G.x2px(0), G.y2py(0)); c.lineTo(G.x2px(co), G.y2py(si)); c.stroke();
        c.lineWidth = 4;
        c.strokeStyle = '#2563eb'; c.beginPath(); c.moveTo(G.x2px(0), G.y2py(0)); c.lineTo(G.x2px(co), G.y2py(0)); c.stroke();
        c.strokeStyle = '#dc2626'; c.beginPath(); c.moveTo(G.x2px(co), G.y2py(0)); c.lineTo(G.x2px(co), G.y2py(si)); c.stroke();
        if (Math.abs(co) > 1e-6) { c.lineWidth = 2; c.strokeStyle = '#16a34a'; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(G.x2px(1), G.y2py(0)); c.lineTo(G.x2px(1), G.y2py(si / co)); c.stroke(); c.setLineDash([]); }
        c.fillStyle = '#111827'; c.beginPath(); c.arc(G.x2px(co), G.y2py(si), 6, 0, 7); c.fill();
        c.font = 'bold 13px system-ui'; c.fillStyle = '#2563eb'; c.fillText('cos θ', G.x2px(co / 2) - 16, G.y2py(0) + (si >= 0 ? 18 : -8));
        c.fillStyle = '#dc2626'; c.fillText('sen θ', G.x2px(co) + 6, G.y2py(si / 2));
        c.restore();
        const ref = P.t % 360, red = ref % 90 === 0 ? ref : null;
        let exatos = '';
        const base = [0, 30, 45, 60, 90].includes(P.t) ? NOT[P.t] : null;
        if (base) exatos = ' &nbsp; ' + tex(`\\cos\\theta=${base[0]},\\ \\operatorname{sen}\\theta=${base[1]},\\ \\operatorname{tg}\\theta=${base[2]}`);
        L.innerHTML = `θ = ${P.t}° = ${fmt(P.t * Math.PI / 180, 3)} rad · <span style="color:#2563eb">cos θ = ${fmt(co, 3)}</span> · <span style="color:#dc2626">sen θ = ${fmt(si, 3)}</span> · <span style="color:#16a34a">tg θ = ${Math.abs(co) < 1e-9 ? 'não existe' : fmt(si / co, 3)}</span>` + exatos;
        void red;
      } });
    g.desenhar();
  }

  // ------------------------------------------------------------------ sucessão
  // data-u="expr em n" data-n="1,30" data-lim="valor" data-soma (mostra também somas parciais)
  function sucessao(el) {
    const P = criarSliders(el, el.dataset.sliders, () => g.desenhar());
    const nomesP = Object.keys(P);
    const fn = compilar(el.dataset.u, ['n', ...nomesP]); const u = n => fn(n, ...nomesP.map(k => P[k]));
    const [n0, n1] = intervalo(el.dataset.n, [1, 25]);
    const viva = formulaViva(el, P);
    const L = leitura(el);
    const yy = intervalo(el.dataset.y, null);
    const g = new Grafico(el, { xmin: n0 - 1, xmax: n1 + 1, ymin: yy ? yy[0] : null, ymax: yy ? yy[1] : null, altura: 300, ratoVertical: true,
      aoMover: x => { const n = Math.round(x); if (n >= n0 && n <= n1) { let S = 0; for (let k = n0; k <= n; k++) S += u(k); L.innerHTML = `u<sub>${n}</sub> = ${fmt(u(n), 4)}` + (el.dataset.soma !== undefined ? ` · soma S<sub>${n}</sub> = ${fmt(S, 4)}` : ''); } } });
    g.desenhar = (orig => () => {
      g.limpar(); viva();
      const pts = []; for (let n = n0; n <= n1; n++) pts.push([n, u(n)]);
      g.amostra(pts.map(p => [p[0], p[1]]), { cor: 'rgba(0,0,0,0)', ignorarEscala: false });
      pts.forEach(([n, v]) => g.ponto(n, v, { cor: '#2563eb', raio: 4 }));
      if (el.dataset.soma !== undefined) { let S = 0; pts.forEach(([n, v]) => { S += v; g.ponto(n, S, { cor: '#16a34a', raio: 3 }); }); }
      if (el.dataset.lim) g.horizontais.push({ y: +el.dataset.lim, cor: '#dc2626', rotulo: 'limite = ' + el.dataset.lim });
      orig();
    })(g.desenhar.bind(g));
    g.desenhar();
  }

  // ------------------------------------------------------------------ vetores
  function vetores(el) {
    const P = criarSliders(el, 'a:-4:4:0.5:3:u₁; b:-4:4:0.5:1:u₂; c:-4:4:0.5:1:v₁; d:-4:4:0.5:2:v₂', () => g.desenhar());
    const L = leitura(el);
    const seta = (c, G, x1, y1, x2, y2, cor, rot) => {
      const X1 = G.x2px(x1), Y1 = G.y2py(y1), X2 = G.x2px(x2), Y2 = G.y2py(y2), an = Math.atan2(Y2 - Y1, X2 - X1);
      c.strokeStyle = c.fillStyle = cor; c.lineWidth = 3; c.beginPath(); c.moveTo(X1, Y1); c.lineTo(X2, Y2); c.stroke();
      c.beginPath(); c.moveTo(X2, Y2); c.lineTo(X2 - 12 * Math.cos(an - .4), Y2 - 12 * Math.sin(an - .4)); c.lineTo(X2 - 12 * Math.cos(an + .4), Y2 - 12 * Math.sin(an + .4)); c.fill();
      c.font = 'bold 13px system-ui'; c.fillText(rot, X2 + 6, Y2 - 6);
    };
    const g = new Grafico(el, { xmin: -8, xmax: 8, ymin: -6, ymax: 6, altura: 340, proporcional: true,
      depois: (c, G) => {
        const { a, b, c: cc, d } = P;
        c.save(); c.setLineDash([5, 4]); c.strokeStyle = '#9ca3af'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(G.x2px(a), G.y2py(b)); c.lineTo(G.x2px(a + cc), G.y2py(b + d)); c.lineTo(G.x2px(cc), G.y2py(d)); c.stroke(); c.setLineDash([]);
        seta(c, G, 0, 0, a, b, '#2563eb', 'u'); seta(c, G, 0, 0, cc, d, '#dc2626', 'v'); seta(c, G, 0, 0, a + cc, b + d, '#16a34a', 'u+v');
        c.restore();
        const dot = a * cc + b * d, nu = Math.hypot(a, b), nv = Math.hypot(cc, d);
        const ang = nu && nv ? Math.acos(Math.max(-1, Math.min(1, dot / (nu * nv)))) * 180 / Math.PI : NaN;
        L.innerHTML = `u = (${fmt(a)}, ${fmt(b)}) · v = (${fmt(cc)}, ${fmt(d)}) · u+v = (${fmt(a + cc)}, ${fmt(b + d)}) · ‖u‖ = ${fmt(nu)} · <b>u·v = ${fmt(dot)}</b> · ângulo ≈ ${fmt(ang, 1)}°` + (Math.abs(dot) < 1e-9 ? ' → <b>perpendiculares</b>' : '') + ` · det[u v] = ${fmt(a * d - b * cc)} (área do paralelogramo = ${fmt(Math.abs(a * d - b * cc))})`;
      } });
    g.desenhar();
  }

  // ------------------------------------------------------------------ campo de direções (EDO y' = f(x,y))
  function campo(el) {
    const fn = compilar(el.dataset.f, ['x', 'y']);
    const [xmin, xmax] = intervalo(el.dataset.x, [-4, 4]); const [ymin, ymax] = intervalo(el.dataset.y, [-3, 3]);
    const L = leitura(el); L.textContent = 'clica no gráfico para escolher a condição inicial y(x₀) = y₀';
    let ini = el.dataset.ini ? el.dataset.ini.split(',').map(Number) : [0, 1];
    const g = new Grafico(el, { xmin, xmax, ymin, ymax, altura: 340,
      depois: (c, G) => {
        c.save(); c.strokeStyle = '#94a3b8'; c.lineWidth = 1.3;
        const nx = 22, ny = 16;
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
          const X = xmin + (xmax - xmin) * i / nx, Y = ymin + (ymax - ymin) * j / ny; const m = fn(X, Y); if (!isFinite(m)) continue;
          const dx = 1 / Math.sqrt(1 + m * m) * (xmax - xmin) / nx * .38, dy = m * dx;
          c.beginPath(); c.moveTo(G.x2px(X - dx), G.y2py(Y - dy)); c.lineTo(G.x2px(X + dx), G.y2py(Y + dy)); c.stroke();
        }
        // solução por RK4 nos dois sentidos
        c.strokeStyle = '#dc2626'; c.lineWidth = 2.5;
        [1, -1].forEach(s => {
          let X = ini[0], Y = ini[1]; const h = 0.01 * s; c.beginPath(); c.moveTo(G.x2px(X), G.y2py(Y));
          for (let k = 0; k < 2000; k++) {
            const k1 = fn(X, Y), k2 = fn(X + h / 2, Y + h * k1 / 2), k3 = fn(X + h / 2, Y + h * k2 / 2), k4 = fn(X + h, Y + h * k3);
            Y += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); X += h; if (!isFinite(Y) || Math.abs(Y) > 50 || X < xmin || X > xmax) break; c.lineTo(G.x2px(X), G.y2py(Y));
          }
          c.stroke();
        });
        c.fillStyle = '#dc2626'; c.beginPath(); c.arc(G.x2px(ini[0]), G.y2py(ini[1]), 5, 0, 7); c.fill(); c.restore();
      } });
    g.canvas.addEventListener('click', e => { const r = g.canvas.getBoundingClientRect(); ini = [g.px2x(e.clientX - r.left), g.py2y(e.clientY - r.top)]; L.textContent = `condição inicial: y(${fmt(ini[0])}) = ${fmt(ini[1])}`; g.desenhar(); });
    g.desenhar();
  }


  // ------------------------------------------------------------------ transformação linear 2×2
  // mostra o quadrado unitário transformado, um vetor v (rato) e Av, e as direções próprias
  function matriz2(el) {
    const ini = (el.dataset.m || '2,1,1,2').split(',').map(Number);
    const P = criarSliders(el, `a:-3:3:0.5:${ini[0]};b:-3:3:0.5:${ini[1]};c:-3:3:0.5:${ini[2]};d:-3:3:0.5:${ini[3]}`, () => g.desenhar());
    if (!el.dataset.formula) el.dataset.formula = 'A = \\begin{bmatrix} {a} & {b} \\\\ {c} & {d} \\end{bmatrix}';
    const viva = formulaViva(el, P);
    const L = leitura(el); L.textContent = 'passa o rato: v (azul) e Av (vermelho)';
    const seta = (c, G, x2, y2, cor, rot) => {
      const X1 = G.x2px(0), Y1 = G.y2py(0), X2 = G.x2px(x2), Y2 = G.y2py(y2), an = Math.atan2(Y2 - Y1, X2 - X1);
      c.strokeStyle = c.fillStyle = cor; c.lineWidth = 3; c.beginPath(); c.moveTo(X1, Y1); c.lineTo(X2, Y2); c.stroke();
      c.beginPath(); c.moveTo(X2, Y2); c.lineTo(X2 - 11 * Math.cos(an - .4), Y2 - 11 * Math.sin(an - .4)); c.lineTo(X2 - 11 * Math.cos(an + .4), Y2 - 11 * Math.sin(an + .4)); c.fill();
      if (rot) { c.font = 'bold 13px system-ui'; c.fillText(rot, X2 + 5, Y2 - 5); }
    };
    let v = [1, 0.5];
    const g = new Grafico(el, { xmin: -6, xmax: 6, ymin: -5, ymax: 5, altura: 360, proporcional: true, mostrarCoords: true,
      aoMover: (x, y) => { v = [x, y]; },
      depois: (c, G) => {
        const { a, b, c: cc, d } = P;
        c.save();
        c.fillStyle = 'rgba(37,99,235,.08)'; c.strokeStyle = '#93c5fd'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(G.x2px(0), G.y2py(0)); c.lineTo(G.x2px(1), G.y2py(0)); c.lineTo(G.x2px(1), G.y2py(1)); c.lineTo(G.x2px(0), G.y2py(1)); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(220,38,38,.12)'; c.strokeStyle = '#fca5a5';
        c.beginPath(); c.moveTo(G.x2px(0), G.y2py(0)); c.lineTo(G.x2px(a), G.y2py(cc)); c.lineTo(G.x2px(a + b), G.y2py(cc + d)); c.lineTo(G.x2px(b), G.y2py(d)); c.closePath(); c.fill(); c.stroke();
        // direções próprias
        const tr = a + d, det = a * d - b * cc, disc = tr * tr - 4 * det; let txt = '';
        if (disc >= -1e-12) {
          const ls = disc < 1e-12 ? [tr / 2] : [(tr + Math.sqrt(disc)) / 2, (tr - Math.sqrt(disc)) / 2];
          ls.forEach(l => {
            let vx, vy; if (Math.abs(b) > 1e-9) { vx = b; vy = l - a; } else if (Math.abs(cc) > 1e-9) { vx = l - d; vy = cc; } else { vx = l === a ? 1 : 0; vy = l === a ? 0 : 1; }
            const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
            c.setLineDash([6, 5]); c.strokeStyle = '#16a34a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(G.x2px(-10 * vx), G.y2py(-10 * vy)); c.lineTo(G.x2px(10 * vx), G.y2py(10 * vy)); c.stroke(); c.setLineDash([]);
          });
          txt = ` · valores próprios λ = ${ls.map(l => fmt(l)).join(' e ')} (retas verdes: direções que não rodam)`;
        } else txt = ' · sem valores próprios reais (a matriz roda todos os vetores)';
        seta(c, G, 1, 0, '#2563eb', 'e₁'); seta(c, G, 0, 1, '#2563eb', 'e₂');
        seta(c, G, a, cc, '#dc2626', 'Ae₁'); seta(c, G, b, d, '#dc2626', 'Ae₂');
        const Av = [a * v[0] + b * v[1], cc * v[0] + d * v[1]];
        seta(c, G, v[0], v[1], '#1d4ed8', 'v'); seta(c, G, Av[0], Av[1], '#b91c1c', 'Av');
        c.restore();
        viva();
        L.innerHTML = `det A = ${fmt(det)} (a área é multiplicada por ${fmt(Math.abs(det))}${det < 0 ? ', e a orientação inverte' : ''})${txt}<br>v = (${fmt(v[0])}, ${fmt(v[1])}) → Av = (${fmt(Av[0])}, ${fmt(Av[1])})`;
      } });
    g.op.manterRato = true;
    g.desenhar();
  }

  const TIPOS = { funcao, riemann, circulo, sucessao, vetores, campo, matriz2 };
  function iniciar() {
    document.querySelectorAll('.gw').forEach(el => {
      try { (TIPOS[el.dataset.tipo || 'funcao'])(el); } catch (e) { el.innerHTML = '<div class="aviso">Erro no gráfico: ' + e.message + '</div>'; console.error(e, el); }
    });
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
