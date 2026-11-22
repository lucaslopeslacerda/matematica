/* Desenhador de gráficos em <canvas> — sem dependências.
   Usado no solver (pontos vindos do Python) e nos guias (funções em JS com sliders). */
(function () {
  const CORES = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

  class Grafico {
    constructor(alvo, op = {}) {
      this.op = Object.assign({ xmin: -10, xmax: 10, ymin: null, ymax: null, altura: 320, grelha: true }, op);
      this.wrap = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
      this.wrap.classList.add('grafico-wrap');
      this.canvas = document.createElement('canvas');
      this.wrap.appendChild(this.canvas);
      this.legenda = document.createElement('div');
      this.legenda.className = 'grafico-legenda';
      this.wrap.appendChild(this.legenda);
      this.curvas = [];      // {f: x=>y  ou  pontos: [[x,y]], cor, nome, largura, tracejado}
      this.pontos = [];      // {x,y,cor,rotulo,vazio}
      this.areas = [];       // {f, a, b, cor}
      this.sinal = null;     // {f}  → colore o eixo x conforme o sinal
      this.verticais = [];   // {x, cor, rotulo}
      this.horizontais = []; // {y, cor, rotulo}
      this.segmentos = [];   // {x1,y1,x2,y2,cor,tracejado}
      this.ratoVertical = op.ratoVertical || false;
      this.ratoHorizontal = op.ratoHorizontal || false;
      this.aoMover = op.aoMover || null;
      this.ratoX = null; this.ratoY = null;
      const mover = (ev) => {
        const r = this.canvas.getBoundingClientRect();
        const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
        this.ratoX = this.px2x(cx); this.ratoY = this.py2y(cy);
        if (this.aoMover) this.aoMover(this.ratoX, this.ratoY, this);
        if (this.ratoVertical || this.ratoHorizontal || this.op.mostrarCoords) this.desenhar();
      };
      this.canvas.addEventListener('mousemove', mover);
      this.canvas.addEventListener('touchmove', (e) => { mover(e); e.preventDefault(); }, { passive: false });
      this.canvas.addEventListener('mouseleave', () => { if (!this.op.manterRato) { this.ratoX = null; this.desenhar(); } });
      new ResizeObserver(() => this.desenhar()).observe(this.wrap);
    }
    limpar() { this.curvas = []; this.pontos = []; this.areas = []; this.sinal = null; this.verticais = []; this.horizontais = []; this.segmentos = []; return this; }
    funcao(f, op = {}) { this.curvas.push(Object.assign({ f, cor: CORES[this.curvas.length % CORES.length], largura: 2.5 }, op)); return this; }
    amostra(pontos, op = {}) { this.curvas.push(Object.assign({ pontos, cor: CORES[this.curvas.length % CORES.length], largura: 2.5 }, op)); return this; }
    ponto(x, y, op = {}) { this.pontos.push(Object.assign({ x, y, cor: '#111827' }, op)); return this; }
    area(f, a, b, cor = 'rgba(37,99,235,.18)') { this.areas.push({ f, a, b, cor }); return this; }

    _amostrar(c) {
      if (c.pontos) return c.pontos;
      const n = 600, out = [];
      const X0 = this.X0 ?? this.op.xmin, X1 = this.X1 ?? this.op.xmax;
      const a = c.dominio ? Math.max(c.dominio[0], X0) : X0;
      const b = c.dominio ? Math.min(c.dominio[1], X1) : X1;
      for (let i = 0; i <= n; i++) {
        const x = a + (b - a) * i / n;
        let y; try { y = c.f(x); } catch (e) { y = NaN; }
        out.push([x, (isFinite(y) && Math.abs(y) < 1e6) ? y : null]);
      }
      return out;
    }
    _limitesY(amostras) {
      if (this.op.ymin !== null && this.op.ymax !== null) return [this.op.ymin, this.op.ymax];
      let ys = [];
      amostras.forEach(p => p.forEach(([x, y]) => { if (y !== null) ys.push(y); }));
      if (!ys.length) return [-10, 10];
      ys.sort((a, b) => a - b);
      let lo = ys[Math.floor(ys.length * 0.03)], hi = ys[Math.floor(ys.length * 0.97) - 1] ?? ys[ys.length - 1];
      if (hi - lo < 1e-6) { lo -= 2; hi += 2; }
      const m = (hi - lo) * 0.15;
      lo = Math.min(lo - m, 0 - m * 0.3); hi = Math.max(hi + m, 0 + m * 0.3);
      if (this.op.ymin !== null) lo = this.op.ymin;
      if (this.op.ymax !== null) hi = this.op.ymax;
      return [lo, hi];
    }
    x2px(x) { return (x - this.X0) / (this.X1 - this.X0) * this.W; }
    y2py(y) { return this.H - (y - this.Y0) / (this.Y1 - this.Y0) * this.H; }
    px2x(px) { return this.X0 + px / this.W * (this.X1 - this.X0); }
    py2y(py) { return this.Y0 + (this.H - py) / this.H * (this.Y1 - this.Y0); }

    _passo(intervalo) {
      const bruto = intervalo / 10, p = Math.pow(10, Math.floor(Math.log10(bruto)));
      const r = bruto / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
    }

    desenhar() {
      const dpr = window.devicePixelRatio || 1;
      const W = this.wrap.clientWidth || 500, H = this.op.altura;
      this.W = W; this.H = H;
      this.canvas.width = W * dpr; this.canvas.height = H * dpr;
      this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
      const g = this.canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      this.X0 = this.op.xmin; this.X1 = this.op.xmax;
      if (this.op.proporcional && this.op.ymin !== null && this.op.ymax !== null) {
        const esc = Math.max((this.X1 - this.X0) / W, (this.op.ymax - this.op.ymin) / H);
        const mx = (this.X0 + this.X1) / 2, my = (this.op.ymin + this.op.ymax) / 2;
        this.X0 = mx - esc * W / 2; this.X1 = mx + esc * W / 2;
        this.Y0 = my - esc * H / 2; this.Y1 = my + esc * H / 2;
      }
      const amostras = this.curvas.map(c => this._amostrar(c));
      if (!(this.op.proporcional && this.op.ymin !== null && this.op.ymax !== null))
        [this.Y0, this.Y1] = this._limitesY(amostras.filter((_, i) => !this.curvas[i].ignorarEscala));
      // grelha
      const sx = this._passo(this.X1 - this.X0), sy = this._passo(this.Y1 - this.Y0);
      g.font = '11px system-ui, sans-serif'; g.fillStyle = '#6b7280';
      if (this.op.grelha) {
        g.strokeStyle = '#eef0f4'; g.lineWidth = 1;
        for (let x = Math.ceil(this.X0 / sx) * sx; x <= this.X1; x += sx) { const p = this.x2px(x); g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke(); }
        for (let y = Math.ceil(this.Y0 / sy) * sy; y <= this.Y1; y += sy) { const p = this.y2py(y); g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); }
      }
      // áreas
      this.areas.forEach(a => {
        g.fillStyle = a.cor; g.beginPath();
        const n = 200; g.moveTo(this.x2px(a.a), this.y2py(0));
        for (let i = 0; i <= n; i++) { const x = a.a + (a.b - a.a) * i / n; let y = a.f(x); if (!isFinite(y)) y = 0; g.lineTo(this.x2px(x), this.y2py(y)); }
        g.lineTo(this.x2px(a.b), this.y2py(0)); g.closePath(); g.fill();
      });
      // eixos
      g.strokeStyle = '#9ca3af'; g.lineWidth = 1.2;
      const ex = this.y2py(0), ey = this.x2px(0);
      if (ex >= 0 && ex <= H) { g.beginPath(); g.moveTo(0, ex); g.lineTo(W, ex); g.stroke(); }
      if (ey >= 0 && ey <= W) { g.beginPath(); g.moveTo(ey, 0); g.lineTo(ey, H); g.stroke(); }
      const fmt = v => Math.abs(v) < 1e-9 ? '0' : (+v.toFixed(4)).toString();
      g.fillStyle = '#6b7280';
      const ly = Math.min(Math.max(ex + 13, 12), H - 3);
      for (let x = Math.ceil(this.X0 / sx) * sx; x <= this.X1; x += sx) if (Math.abs(x) > 1e-9) g.fillText(fmt(x), this.x2px(x) + 2, ly);
      const lx = Math.min(Math.max(ey + 3, 2), W - 30);
      for (let y = Math.ceil(this.Y0 / sy) * sy; y <= this.Y1; y += sy) if (Math.abs(y) > 1e-9) g.fillText(fmt(y), lx, this.y2py(y) - 2);
      // sinal no eixo x
      if (this.sinal) {
        const n = 400;
        for (let i = 0; i < n; i++) {
          const x = this.X0 + (this.X1 - this.X0) * (i + .5) / n; let y = this.sinal.f(x);
          if (!isFinite(y)) continue;
          g.strokeStyle = y > 1e-9 ? 'rgba(22,163,74,.85)' : y < -1e-9 ? 'rgba(220,38,38,.85)' : '#111';
          g.lineWidth = 6; g.beginPath(); g.moveTo(this.x2px(this.X0 + (this.X1 - this.X0) * i / n), ex); g.lineTo(this.x2px(this.X0 + (this.X1 - this.X0) * (i + 1) / n), ex); g.stroke();
        }
      }
      // linhas de referência
      const linhaTrac = (x1, y1, x2, y2, cor, trac = true, w = 1.5) => { g.save(); g.strokeStyle = cor; g.lineWidth = w; if (trac) g.setLineDash([6, 5]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore(); };
      this.verticais.forEach(v => { linhaTrac(this.x2px(v.x), 0, this.x2px(v.x), H, v.cor || '#6b7280'); if (v.rotulo) { g.fillStyle = v.cor || '#374151'; g.fillText(v.rotulo, this.x2px(v.x) + 4, 14); } });
      this.horizontais.forEach(v => { linhaTrac(0, this.y2py(v.y), W, this.y2py(v.y), v.cor || '#6b7280'); if (v.rotulo) { g.fillStyle = v.cor || '#374151'; g.fillText(v.rotulo, 4, this.y2py(v.y) - 4); } });
      this.segmentos.forEach(s => linhaTrac(this.x2px(s.x1), this.y2py(s.y1), this.x2px(s.x2), this.y2py(s.y2), s.cor || '#6b7280', s.tracejado !== false, s.largura || 1.5));
      // curvas
      this.curvas.forEach((c, i) => {
        const pts = amostras[i]; g.save(); g.strokeStyle = c.cor; g.lineWidth = c.largura; if (c.tracejado) g.setLineDash([7, 6]);
        g.beginPath(); let caneta = false, yAnt = null;
        pts.forEach(([x, y]) => {
          if (y === null) { caneta = false; return; }
          const px = this.x2px(x), py = this.y2py(y);
          if (caneta && yAnt !== null && Math.abs(py - yAnt) > H * 1.5) caneta = false; // assíntota
          if (!caneta) { g.moveTo(px, py); caneta = true; } else g.lineTo(px, py);
          yAnt = py;
        });
        g.stroke(); g.restore();
      });
      // pontos
      this.pontos.forEach(p => {
        const px = this.x2px(p.x), py = this.y2py(p.y);
        g.beginPath(); g.arc(px, py, p.raio || 5, 0, 2 * Math.PI);
        if (p.vazio) { g.fillStyle = '#fff'; g.fill(); g.strokeStyle = p.cor; g.lineWidth = 2; g.stroke(); } else { g.fillStyle = p.cor; g.fill(); }
        if (p.rotulo) { g.fillStyle = p.cor; g.font = 'bold 12px system-ui, sans-serif'; g.fillText(p.rotulo, px + 7, py - 7); g.font = '11px system-ui, sans-serif'; }
      });
      // rato
      if (this.ratoX !== null && this.ratoVertical) {
        linhaTrac(this.x2px(this.ratoX), 0, this.x2px(this.ratoX), H, '#f59e0b', false, 2);
      }
      if (this.ratoY !== null && this.ratoX !== null && this.ratoHorizontal) {
        linhaTrac(0, this.y2py(this.ratoY), W, this.y2py(this.ratoY), '#f59e0b', false, 2);
      }
      if (this.op.depois) this.op.depois(g, this);
      // legenda
      const nomes = this.curvas.filter(c => c.nome);
      this.legenda.innerHTML = nomes.map(c => `<span><i style="background:${c.cor}"></i>${c.nome}</span>`).join('');
    }
  }
  window.Grafico = Grafico;
})();
