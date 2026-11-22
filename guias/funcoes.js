/* Gráficos interativos do guia de Funções */
(() => {
  const $ = s => document.querySelector(s);
  const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(d)).toString().replace('.', ',');
  const tex = (s, d = false) => { try { return katex.renderToString(s, { displayMode: d, throwOnError: false }); } catch (e) { return s; } };
  const num = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2)));

  // raízes de f num intervalo (mudança de sinal + bisseção)
  function zeros(f, a, b, n = 2000) {
    const out = []; let xa = a, ya = f(a);
    for (let i = 1; i <= n; i++) {
      const xb = a + (b - a) * i / n, yb = f(xb);
      if (isFinite(ya) && isFinite(yb)) {
        if (ya === 0) out.push(xa);
        else if (ya * yb < 0) { let l = xa, r = xb; for (let k = 0; k < 50; k++) { const m = (l + r) / 2; (f(l) * f(m) <= 0) ? r = m : l = m; } out.push((l + r) / 2); }
      }
      xa = xb; ya = yb;
    }
    return out.filter((z, i) => i === 0 || Math.abs(z - out[i - 1]) > 1e-6);
  }
  const deriv = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

  function iniciar() {
    // ---------------------------------------------------- 1. táxi
    {
      const P = d => 3.25 + 0.9 * d;
      const g = new Grafico('#g-taxi', { xmin: -1, xmax: 20, ymin: -2, ymax: 22, altura: 280, mostrarCoords: true,
        aoMover: (x) => {
          if (x < 0) { $('#l-taxi').textContent = 'distâncias negativas não fazem sentido aqui'; g.pontos = []; return; }
          g.pontos = [{ x, y: P(x), cor: '#dc2626', rotulo: `(${fmt(x, 1)} km ; ${fmt(P(x))} €)` }];
          g.segmentos = [{ x1: x, y1: 0, x2: x, y2: P(x) }, { x1: 0, y1: P(x), x2: x, y2: P(x) }];
          $('#l-taxi').textContent = `objeto x = ${fmt(x, 1)} km  →  imagem P(x) = ${fmt(P(x))} €`;
        } });
      g.funcao(P, { dominio: [0, 20], nome: 'preço (€) em função da distância (km)' }).desenhar();
    }

    // ---------------------------------------------------- 3. reta vertical
    {
      const curvas = {
        parabola: [x => x * x - 2],
        circ: [x => Math.sqrt(16 - x * x), x => -Math.sqrt(16 - x * x)],
        deitada: [x => Math.sqrt(x), x => -Math.sqrt(x)],
        seno: [x => 3 * Math.sin(x)],
      };
      const g = new Grafico('#g-rv', { xmin: -7, xmax: 7, ymin: -6, ymax: 6, altura: 320, ratoVertical: true, proporcional: true,
        aoMover: (x) => {
          const fs = curvas[$('#sel-rv').value];
          const pts = []; fs.forEach(f => { const y = f(x); if (isFinite(y)) pts.push(y); });
          const unicos = pts.filter((y, i) => pts.findIndex(z => Math.abs(z - y) < 1e-6) === i);
          g.pontos = unicos.map(y => ({ x, y, cor: unicos.length > 1 ? '#dc2626' : '#16a34a' }));
          const n = unicos.length;
          $('#l-rv').innerHTML = n === 0 ? `x = ${fmt(x)}: a reta não toca o gráfico (x fora do domínio)` :
            n === 1 ? `x = ${fmt(x)}: corta em <b style="color:#16a34a">1 ponto</b> ✔` :
              `x = ${fmt(x)}: corta em <b style="color:#dc2626">${n} pontos</b>, portanto NÃO é função ✘`;
        } });
      const desenha = () => { g.limpar(); curvas[$('#sel-rv').value].forEach(f => g.funcao(f, { cor: '#2563eb' })); g.desenhar(); };
      $('#sel-rv').onchange = desenha; desenha();
    }

    // ---------------------------------------------------- 4. domínio / contradomínio
    {
      const F = {
        raiz: { f: x => Math.sqrt(x + 2), dom: [-2, Infinity], cd: [0, Infinity], tx: 'f(x)=\\sqrt{x+2}', d: 'D_f=[-2,+\\infty[', c: "D'_f=[0,+\\infty[", ab: [[-2, true]] },
        quad: { f: x => x * x - 4 * x + 1, dom: [-Infinity, Infinity], cd: [-3, Infinity], tx: 'f(x)=x^2-4x+1', d: 'D_f=\\mathbb{R}', c: "D'_f=[-3,+\\infty[" },
        frac: { f: x => 1 / (x - 1), dom: null, cd: null, tx: 'f(x)=\\dfrac{1}{x-1}', d: 'D_f=\\mathbb{R}\\setminus\\{1\\}', c: "D'_f=\\mathbb{R}\\setminus\\{0\\}", buracoX: 1, buracoY: 0 },
        ln: { f: x => Math.log(x - 1), dom: [1, Infinity], cd: [-Infinity, Infinity], tx: 'f(x)=\\ln(x-1)', d: 'D_f=]1,+\\infty[', c: "D'_f=\\mathbb{R}", abertoX: 1 },
        seno: { f: x => 2 * Math.sin(x) + 1, dom: [-Infinity, Infinity], cd: [-1, 3], tx: 'f(x)=2\\operatorname{sen}x+1', d: 'D_f=\\mathbb{R}', c: "D'_f=[-1,3]" },
      };
      const g = new Grafico('#g-dom', { xmin: -6, xmax: 8, ymin: -5, ymax: 6, altura: 320 });
      const desenha = () => {
        const k = F[$('#sel-dom').value];
        g.limpar().funcao(k.f, { cor: '#2563eb', nome: 'f' });
        g.op.depois = (c, G) => {
          c.save(); c.lineWidth = 7; c.lineCap = 'round';
          const y0 = G.y2py(0), x0 = G.x2px(0);
          c.strokeStyle = 'rgba(79,70,229,.55)';
          if (k.dom) { c.beginPath(); c.moveTo(G.x2px(Math.max(k.dom[0], G.op.xmin)), y0); c.lineTo(G.x2px(Math.min(k.dom[1], G.op.xmax)), y0); c.stroke(); }
          else { c.beginPath(); c.moveTo(G.x2px(G.op.xmin), y0); c.lineTo(G.x2px(k.buracoX - .08), y0); c.moveTo(G.x2px(k.buracoX + .08), y0); c.lineTo(G.x2px(G.op.xmax), y0); c.stroke(); }
          c.strokeStyle = 'rgba(22,163,74,.6)';
          if (k.cd) { c.beginPath(); c.moveTo(x0, G.y2py(Math.max(k.cd[0], G.Y0))); c.lineTo(x0, G.y2py(Math.min(k.cd[1], G.Y1))); c.stroke(); }
          else { c.beginPath(); c.moveTo(x0, G.y2py(G.Y0)); c.lineTo(x0, G.y2py(k.buracoY - .08)); c.moveTo(x0, G.y2py(k.buracoY + .08)); c.lineTo(x0, G.y2py(G.Y1)); c.stroke(); }
          c.restore();
          c.font = 'bold 12px system-ui'; c.fillStyle = '#4f46e5'; c.fillText('domínio (no eixo x)', G.x2px(G.op.xmax) - 130, y0 + 22);
          c.fillStyle = '#16a34a'; c.fillText('contradomínio (no eixo y)', x0 + 8, 16);
        };
        if (k.ab) g.ponto(-2, 0, { cor: '#2563eb' });
        if (k.abertoX) g.verticais.push({ x: 1, cor: '#9ca3af', rotulo: 'x = 1 (assíntota)' });
        if (k.buracoX !== undefined) { g.verticais.push({ x: 1, cor: '#9ca3af', rotulo: 'x = 1' }); g.horizontais.push({ y: 0.001, cor: '#9ca3af' }); }
        g.desenhar();
        $('#f-dom').innerHTML = tex(k.tx) + ' &nbsp;&nbsp; ' + tex(k.d) + ' &nbsp;&nbsp; ' + tex(k.c);
      };
      $('#sel-dom').onchange = desenha; desenha();
    }

    // ---------------------------------------------------- 5. leitura
    {
      const f = x => 0.25 * (x + 3) * (x - 1) * (x - 4);
      const g = new Grafico('#g-leitura', { xmin: -5, xmax: 6, ymin: -8, ymax: 10, altura: 340, ratoVertical: true,
        aoMover: (x) => {
          const y = f(x), d = deriv(f, x);
          g.pontos = base.concat([{ x, y, cor: '#f59e0b', rotulo: `(${fmt(x)}; ${fmt(y)})` }]);
          $('#l-leitura').innerHTML = `f(${fmt(x)}) = ${fmt(y)} → ${Math.abs(y) < .05 ? '<b>zero!</b>' : y > 0 ? '<b style="color:#16a34a">positiva</b>' : '<b style="color:#dc2626">negativa</b>'} · ` +
            (Math.abs(d) < .08 ? '<b>quase horizontal (extremo)</b>' : d > 0 ? 'a função está a <b>crescer ↗</b>' : 'a função está a <b>decrescer ↘</b>');
        } });
      const zs = zeros(f, -5, 6);
      const crit = zeros(x => deriv(f, x), -5, 6);
      const base = zs.map(z => ({ x: z, y: 0, cor: '#111827', rotulo: 'zero' }))
        .concat(crit.map(c => ({ x: c, y: f(c), cor: '#9333ea', rotulo: deriv(f, c - .1) > 0 ? 'máx.' : 'mín.' })));
      g.funcao(f, { cor: '#2563eb', nome: 'f(x)' }); g.sinal = { f }; g.pontos = base.slice(); g.desenhar();
      const [c1, c2] = crit;
      $('#quadro-var').innerHTML = `<table class="tabela"><tr><th>x</th><td>−∞</td><td></td><td>${fmt(c1)}</td><td></td><td>${fmt(c2)}</td><td></td><td>+∞</td></tr>
        <tr><th>f</th><td></td><td>↗</td><td><b>${fmt(f(c1))}</b><br><small>máx.</small></td><td>↘</td><td><b>${fmt(f(c2))}</b><br><small>mín.</small></td><td>↗</td><td></td></tr></table>
        <p style="font-size:.9rem;color:#6b7280">Zeros: x = −3, x = 1, x = 4. f &gt; 0 em ]−3, 1[ ∪ ]4, +∞[; f &lt; 0 em ]−∞, −3[ ∪ ]1, 4[.</p>`;
    }

    // ---------------------------------------------------- 6. biblioteca
    {
      const L = [
        ['Constante', 'f(x)=c', x => 2, '\\mathbb{R}', '\\{c\\}'],
        ['Identidade', 'f(x)=x', x => x, '\\mathbb{R}', '\\mathbb{R}'],
        ['Quadrática', 'f(x)=x^2', x => x * x, '\\mathbb{R}', '[0,+\\infty['],
        ['Cúbica', 'f(x)=x^3', x => x ** 3, '\\mathbb{R}', '\\mathbb{R}'],
        ['Módulo', 'f(x)=|x|', x => Math.abs(x), '\\mathbb{R}', '[0,+\\infty['],
        ['Raiz quadrada', 'f(x)=\\sqrt{x}', x => Math.sqrt(x), '[0,+\\infty[', '[0,+\\infty['],
        ['Raiz cúbica', 'f(x)=\\sqrt[3]{x}', x => Math.cbrt(x), '\\mathbb{R}', '\\mathbb{R}'],
        ['Proporcionalidade inversa', 'f(x)=\\dfrac{1}{x}', x => 1 / x, '\\mathbb{R}\\setminus\\{0\\}', '\\mathbb{R}\\setminus\\{0\\}'],
        ['Exponencial', 'f(x)=e^x', x => Math.exp(x), '\\mathbb{R}', ']0,+\\infty['],
        ['Logaritmo', 'f(x)=\\ln x', x => Math.log(x), ']0,+\\infty[', '\\mathbb{R}'],
        ['Seno', 'f(x)=\\operatorname{sen} x', x => Math.sin(x), '\\mathbb{R}', '[-1,1]'],
        ['Cosseno', 'f(x)=\\cos x', x => Math.cos(x), '\\mathbb{R}', '[-1,1]'],
        ['Tangente', 'f(x)=\\operatorname{tg} x', x => Math.tan(x), 'x\\neq\\tfrac{\\pi}{2}+k\\pi', '\\mathbb{R}'],
      ];
      const box = $('#biblioteca-grelha');
      L.forEach(([nome, fx, f, d, c], i) => {
        const el = document.createElement('div'); el.className = 'mini';
        el.innerHTML = `<h4>${nome}</h4><div class="ff">${tex(fx)}</div><div id="mini-${i}"></div><small>${tex('D=' + d)} &nbsp; ${tex("D'=" + c)}</small>`;
        box.appendChild(el);
        const trig = nome === 'Seno' || nome === 'Cosseno' || nome === 'Tangente';
        new Grafico(`#mini-${i}`, { xmin: trig ? -7 : -4, xmax: trig ? 7 : 4, ymin: -3, ymax: 3, altura: 150, grelha: true }).funcao(f, { cor: '#4f46e5', largura: 2.5 }).desenhar();
      });
    }

    // ---------------------------------------------------- 7. afim
    {
      const g = new Grafico('#g-afim', { xmin: -8, xmax: 8, ymin: -8, ymax: 8, altura: 320, proporcional: true });
      const up = () => {
        const m = +$('#af-m').value, b = +$('#af-b').value;
        $('#af-mo').textContent = num(m); $('#af-bo').textContent = num(b);
        const s = (b >= 0 ? '+' : '-') + num(Math.abs(b));
        $('#af-f').innerHTML = tex(`f(x) = ${num(m)}x ${b === 0 ? '' : s}`) + (m === 0 ? ' &nbsp;(reta horizontal)' : ` &nbsp; zero: ${tex('x = ' + num(-b / m))}`);
        g.limpar().funcao(x => m * x + b, { cor: '#2563eb', nome: 'f(x) = mx + b' });
        g.ponto(0, b, { cor: '#16a34a', rotulo: 'ordenada na origem b' });
        if (m !== 0) g.ponto(-b / m, 0, { cor: '#111827', rotulo: 'zero' });
        g.segmentos = [{ x1: 1, y1: m + b, x2: 2, y2: m + b, cor: '#ea580c', tracejado: false, largura: 3 }, { x1: 2, y1: m + b, x2: 2, y2: 2 * m + b, cor: '#ea580c', tracejado: false, largura: 3 }];
        g.op.depois = (c, G) => { c.fillStyle = '#ea580c'; c.font = 'bold 12px system-ui'; c.fillText('1', G.x2px(1.45), G.y2py(m + b) + (m >= 0 ? 15 : -6)); c.fillText('m = ' + num(m), G.x2px(2) + 6, G.y2py(1.5 * m + b)); };
        g.desenhar();
      };
      ['#af-m', '#af-b'].forEach(s => $(s).oninput = up); up();
    }

    // ---------------------------------------------------- 8. quadrática
    {
      const g = new Grafico('#g-quad', { xmin: -8, xmax: 8, ymin: -8, ymax: 8, altura: 330, proporcional: true });
      const up = () => {
        let a = +$('#q-a').value; const h = +$('#q-h').value, k = +$('#q-k').value;
        if (a === 0) a = 0.25;
        $('#q-ao').textContent = num(a); $('#q-ho').textContent = num(h); $('#q-ko').textContent = num(k);
        const hs = h === 0 ? 'x' : `(x ${h > 0 ? '-' : '+'} ${num(Math.abs(h))})`;
        const ks = k === 0 ? '' : (k > 0 ? '+' : '-') + num(Math.abs(k));
        const B = -2 * a * h, C = a * h * h + k;
        $('#q-f').innerHTML = tex(`f(x) = ${num(a) === '1' ? '' : num(a) === '-1' ? '-' : num(a)}${hs}^2 ${ks}`) + ' &nbsp;=&nbsp; ' +
          tex(`${num(a) === '1' ? '' : num(a) === '-1' ? '-' : num(a)}x^2 ${B === 0 ? '' : (B > 0 ? '+' : '-') + num(Math.abs(B)) + 'x'} ${C === 0 ? '' : (C > 0 ? '+' : '-') + num(Math.abs(C))}`);
        const f = x => a * (x - h) ** 2 + k;
        g.limpar().funcao(f, { cor: '#2563eb', nome: 'f(x)' });
        g.verticais.push({ x: h, cor: '#9333ea', rotulo: 'eixo x = ' + num(h) });
        g.ponto(h, k, { cor: '#9333ea', rotulo: `V(${num(h)}, ${num(k)})` });
        const disc = -k / a; let txt;
        if (disc > 1e-12) { const r = Math.sqrt(disc); g.ponto(h - r, 0, { cor: '#111827' }); g.ponto(h + r, 0, { cor: '#111827' }); txt = `Δ > 0 → 2 zeros: x ≈ ${fmt(h - r)} e x ≈ ${fmt(h + r)}`; }
        else if (Math.abs(disc) <= 1e-12) txt = 'Δ = 0 → 1 zero (o vértice toca o eixo)';
        else txt = 'Δ < 0 → sem zeros (a parábola não toca o eixo dos x)';
        $('#l-quad').textContent = (a > 0 ? 'Concavidade para cima ∪ · mínimo = ' : 'Concavidade para baixo ∩ · máximo = ') + num(k) + ' · ' + txt;
        g.desenhar();
      };
      ['#q-a', '#q-h', '#q-k'].forEach(s => $(s).oninput = up); up();
    }

    // ---------------------------------------------------- 9. transformações
    {
      const B = { x2: [x => x * x, 'x^2'], abs: [x => Math.abs(x), '|x|'], sqrt: [x => Math.sqrt(x), '\\sqrt{x}'], x3: [x => x ** 3, 'x^3'], sen: [x => Math.sin(x), '\\operatorname{sen}'], inv: [x => 1 / x, '\\frac{1}{x}'], exp: [x => Math.exp(x), 'e^{x}'] };
      const g = new Grafico('#g-transf', { xmin: -8, xmax: 8, ymin: -7, ymax: 7, altura: 340, proporcional: true });
      const up = () => {
        const [f, nome] = B[$('#t-base').value];
        const a = +$('#t-a').value, b = +$('#t-b').value || 0.25, h = +$('#t-h').value, k = +$('#t-k').value;
        ['a', 'b', 'h', 'k'].forEach(v => $('#t-' + v + 'o').textContent = num(+$('#t-' + v).value));
        const xh = h === 0 ? 'x' : `x ${h > 0 ? '-' : '+'} ${num(Math.abs(h))}`;
        const dentro = b === 1 ? xh : (b === -1 ? '-' : num(b)) + (h === 0 ? 'x' : `(${xh})`);
        const fx = `f\\!\\left(${dentro}\\right)`;
        $('#t-f').innerHTML = tex(`g(x) = ${a === 1 ? '' : a === -1 ? '-' : num(a)}${fx} ${k === 0 ? '' : (k > 0 ? '+' : '-') + num(Math.abs(k))}`) + ' &nbsp; com &nbsp;' + tex('f(x) = ' + (nome === '\\operatorname{sen}' ? '\\operatorname{sen} x' : nome));
        g.limpar().funcao(f, { cor: '#9ca3af', tracejado: true, nome: 'f (original)' }).funcao(x => a * f(b * (x - h)) + k, { cor: '#dc2626', nome: 'g (transformada)' }).desenhar();
      };
      ['#t-base', '#t-a', '#t-b', '#t-h', '#t-k'].forEach(s => $(s).oninput = up);
      $('#t-reset').onclick = () => { $('#t-a').value = 1; $('#t-b').value = 1; $('#t-h').value = 0; $('#t-k').value = 0; up(); };
      up();
    }

    // ---------------------------------------------------- 10. paridade
    {
      const F = { par: x => x * x - 3, impar: x => x ** 3 / 4 - x, nenhuma: x => x * x + 2 * x, cos: x => 3 * Math.cos(x) };
      const g = new Grafico('#g-par', { xmin: -6, xmax: 6, ymin: -6, ymax: 6, altura: 320, proporcional: true,
        aoMover: (x) => {
          const f = F[$('#sel-par').value]; const a = f(x), b = f(-x);
          g.pontos = [{ x, y: a, cor: '#2563eb', rotulo: 'f(x)' }, { x: -x, y: b, cor: '#dc2626', rotulo: 'f(−x)' }];
          g.segmentos = [{ x1: x, y1: a, x2: -x, y2: b, cor: '#9ca3af' }];
          const rel = Math.abs(a - b) < 1e-6 ? '<b style="color:#16a34a">f(−x) = f(x)</b>' : Math.abs(a + b) < 1e-6 ? '<b style="color:#9333ea">f(−x) = −f(x)</b>' : 'f(−x) ≠ f(x) e f(−x) ≠ −f(x)';
          $('#l-par').innerHTML = `f(${fmt(x)}) = ${fmt(a)} · f(${fmt(-x)}) = ${fmt(b)} → ${rel}`;
        } });
      const desenha = () => { g.limpar().funcao(F[$('#sel-par').value], { cor: '#2563eb' }); g.desenhar(); };
      $('#sel-par').onchange = desenha; desenha();
    }

    // ---------------------------------------------------- 12. reta horizontal + inversa
    {
      const F = { x2: x => x * x, x3: x => x ** 3 / 8, exp: x => Math.exp(x), sen: x => 3 * Math.sin(x) };
      const g = new Grafico('#g-rh', { xmin: -6, xmax: 6, ymin: -5, ymax: 7, altura: 300, ratoHorizontal: true,
        aoMover: (x, y) => {
          const f = F[$('#sel-rh').value];
          const zs = zeros(t => f(t) - y, -6, 6);
          g.pontos = zs.map(z => ({ x: z, y, cor: zs.length > 1 ? '#dc2626' : '#16a34a' }));
          $('#l-rh').innerHTML = zs.length > 1 ? `y = ${fmt(y)}: <b style="color:#dc2626">${zs.length} objetos</b> com a mesma imagem → não é injetiva` : zs.length === 1 ? `y = ${fmt(y)}: só 1 objeto ✔` : `y = ${fmt(y)}: nenhum objeto (fora do contradomínio)`;
        } });
      const d1 = () => { g.limpar().funcao(F[$('#sel-rh').value], { cor: '#2563eb' }); g.desenhar(); };
      $('#sel-rh').onchange = d1; d1();

      const I = {
        afim: [x => 2 * x + 1, x => (x - 1) / 2, null], cubo: [x => x ** 3 / 4, x => Math.cbrt(4 * x), null],
        exp: [x => Math.exp(x), x => Math.log(x), null], quad: [x => x * x, x => Math.sqrt(x), [0, 99]],
      };
      const gi = new Grafico('#g-inv', { xmin: -6, xmax: 6, ymin: -6, ymax: 6, altura: 340, proporcional: true,
        aoMover: (x) => {
          const [f, , dom] = I[$('#sel-inv').value];
          if (dom && x < dom[0]) return;
          const y = f(x); if (!isFinite(y)) return;
          gi.pontos = [{ x, y, cor: '#2563eb', rotulo: `(${fmt(x)}, ${fmt(y)})` }, { x: y, y: x, cor: '#dc2626', rotulo: `(${fmt(y)}, ${fmt(x)})` }];
          gi.segmentos = [{ x1: x, y1: y, x2: y, y2: x, cor: '#9ca3af' }];
          $('#l-inv').textContent = `f(${fmt(x)}) = ${fmt(y)}   ⇔   f⁻¹(${fmt(y)}) = ${fmt(x)}`;
        } });
      const d2 = () => {
        const [f, fi, dom] = I[$('#sel-inv').value];
        gi.limpar().funcao(x => x, { cor: '#9ca3af', tracejado: true, nome: 'y = x' }).funcao(f, { cor: '#2563eb', nome: 'f', dominio: dom || [-99, 99] }).funcao(fi, { cor: '#dc2626', nome: 'f⁻¹' }).desenhar();
      };
      $('#sel-inv').onchange = d2; d2();
    }

    // ---------------------------------------------------- 13. ramos
    {
      const g = new Grafico('#g-ramos', { xmin: -6, xmax: 7, ymin: -3, ymax: 6, altura: 300, ratoVertical: true,
        aoMover: (x) => {
          const [r, y] = x < -1 ? ['1.º ramo: x + 3', x + 3] : x < 2 ? ['2.º ramo: x²', x * x] : ['3.º ramo: 5 − x', 5 - x];
          $('#l-ramos').textContent = `x = ${fmt(x)} → ${r} → f(x) = ${fmt(y)}`;
        } });
      g.funcao(x => x + 3, { dominio: [-99, -1], cor: '#2563eb' }).funcao(x => x * x, { dominio: [-1, 2], cor: '#16a34a' }).funcao(x => 5 - x, { dominio: [2, 99], cor: '#9333ea' });
      g.pontos = [{ x: -1, y: 2, cor: '#2563eb', vazio: true }, { x: -1, y: 1, cor: '#16a34a' }, { x: 2, y: 4, cor: '#16a34a', vazio: true }, { x: 2, y: 3, cor: '#9333ea' }];
      const base = g.pontos.slice();
      g.aoMover = ((orig) => (x, y, G) => { orig(x, y, G); G.pontos = base; })(g.aoMover);
      g.desenhar();
    }

    // KaTeX no texto
    renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
