/* Interpreta texto colado (LaTeX, Unicode, Symbolab, Wolfram, Word…) e descobre o tipo de exercício.
   Devolve { tipo, expr, a, b, var } — tipo pode ser null (mantém o atual). */
(() => {
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ˣ': 'x', 'ʸ': 'y', 'ᵗ': 't', 'ᵏ': 'k' };
  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  const FRAC = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅙': '(1/6)', '⅛': '(1/8)' };

  // conteúdo entre chavetas equilibradas a partir de s[i] === '{'
  function chaveta(s, i) {
    let n = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') n++;
      else if (s[j] === '}') { n--; if (!n) return [s.slice(i + 1, j), j + 1]; }
    }
    return [s.slice(i + 1), s.length];
  }
  // argumento LaTeX: {…} ou um único carácter/comando
  function argumento(s, i) {
    while (s[i] === ' ') i++;
    if (s[i] === '{') return chaveta(s, i);
    const m = s.slice(i).match(/^(\\[a-zA-Z]+|.)/);
    return [m ? m[0] : '', i + (m ? m[0].length : 1)];
  }

  function latexParaTexto(s) {
    s = s.replace(/\$/g, '').replace(/\\displaystyle|\\limits|\\,|\\;|\\:|\\!|\\quad|\\qquad/g, ' ')
      .replace(/\\left|\\right|\\bigl|\\bigr|\\Bigl|\\Bigr|\\big|\\Big/g, '')
      .replace(/\\[dt]frac/g, '\\frac').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/')
      .replace(/\\operatorname\{([a-z]+)\}/g, '\\$1').replace(/\\mathrm\{([a-z]+)\}/g, '$1');
    // \frac{A}{B}  e  \sqrt[n]{A}  \sqrt{A}
    for (let guarda = 0; guarda < 50; guarda++) {
      let i = s.search(/\\frac|\\sqrt/);
      if (i < 0) break;
      if (s.startsWith('\\frac', i)) {
        const [A, j] = argumento(s, i + 5); const [B, k] = argumento(s, j);
        s = s.slice(0, i) + `((${A})/(${B}))` + s.slice(k);
      } else {
        let j = i + 5, n = null;
        if (s[j] === '[') { const f = s.indexOf(']', j); n = s.slice(j + 1, f); j = f + 1; }
        const [A, k] = argumento(s, j);
        s = s.slice(0, i) + (n ? `((${A})^(1/(${n})))` : `sqrt(${A})`) + s.slice(k);
      }
    }
    s = s.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|sen|tg)\b/g, ' $1')
      .replace(/\\pi/g, 'pi').replace(/\\infty/g, 'oo').replace(/\\theta/g, 'theta').replace(/\\alpha/g, 'alpha')
      .replace(/\\to|\\rightarrow/g, '->').replace(/\\le(q)?/g, '<=').replace(/\\ge(q)?/g, '>=').replace(/\\neq/g, '!=')
      .replace(/[{}]/g, m => (m === '{' ? '(' : ')')).replace(/\\/g, ' ');
    return s;
  }

  function unicodeParaTexto(s) {
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿˣʸᵗᵏ]+/g, m => '^(' + [...m].map(c => SUP[c]).join('') + ')')
      .replace(/[₀-₉]/g, c => SUB[c]).replace(/[½⅓⅔¼¾⅕⅙⅛]/g, c => FRAC[c])
      .replace(/[−–—]/g, '-').replace(/[·×⋅∙]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/∞/g, 'oo')
      .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([a-zA-Z0-9.]+)/g, 'sqrt($1)').replace(/∛\s*\(([^)]*)\)/g, '(($1)^(1/3))')
      .replace(/→|⟶/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/ /g, ' ');
    return s;
  }

  function limpaFinal(s) {
    return s.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
      .replace(/^(f|g|h|y)\s*\(\s*x\s*\)\s*=\s*/i, '');   // "f(x) = …" → só a expressão
  }

  function interpretar(bruto) {
    let t = String(bruto || '').trim().replace(/^\$+|\$+$/g, '').trim();
    if (!t) return null;
    t = t.replace(/^(f|g|h|y)\s*\(\s*x\s*\)\s*=\s*/i, '').replace(/^y\s*=\s*(?=.*x)/, '');
    const ehLatex = /\\[a-zA-Z]/.test(t) || /\^\{/.test(t);
    // --- matriz / sistema
    if (/\\begin\{[pbvB]?matrix\}|\\begin\{array\}/.test(t)) {
      const corpo = t.replace(/\\begin\{[a-zA-Z]*\}(\{[^}]*\})?|\\end\{[a-zA-Z]*\}|\\left|\\right|[()[\]|]/g, '');
      return { tipo: 'gauss', aum: /array/.test(t) ? 'sim' : 'nao', expr: corpo.split('\\\\').map(l => l.replace(/&/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') };
    }
    if (/^[\s\d.,;\-+/|]+$/.test(t) && /[\n;]/.test(t)) return { tipo: 'gauss', expr: t.replace(/\|/g, ' ').replace(/,/g, ' ').replace(/;/g, '\n') };
    // sistema de equações lineares (várias linhas com '=')
    const linhasEq = t.split(/\n|;|\\\\/).map(l => l.trim()).filter(l => l.includes('='));
    if (linhasEq.length >= 2) {
      const m = sistemaParaMatriz(linhasEq.map(l => limpaFinal(unicodeParaTexto(ehLatex ? latexParaTexto(l) : l))));
      if (m) return { tipo: 'gauss', aum: 'sim', expr: m };
    }
    // --- derivada (antes de converter \frac)
    let tipo = null, a = '', b = '', v = '';
    let m;
    if ((m = t.match(/^\s*\\?d?frac\s*\{\s*d\s*\}\s*\{\s*d\s*([a-z])\s*\}/)) || (m = t.match(/^\s*d\s*\/\s*d([a-z])/i)) ||
        (m = t.match(/^\s*(?:derivada de|derivative of|derive|differentiate)\s*/i))) {
      tipo = 'derivada'; v = m[1] || ''; t = t.slice(m[0].length);
    } else if ((m = t.match(/^\s*(?:\\int|∫|integral de|integral of|integrate)\s*(?:_\s*\{?([^}^\s]+)\}?\s*\^\s*\{?([^}\s]+)\}?)?/i))) {
      tipo = 'integral'; a = m[1] || ''; b = m[2] || ''; t = t.slice(m[0].length);
      const dx = t.match(/\\?,?\s*\\?(?:mathrm\{d\}|d)\s*([a-z])\s*$/);
      if (dx) { v = dx[1]; t = t.slice(0, dx.index); }
      const lim = t.match(/\s*(?:from|de)\s+(\S+)\s+(?:to|a)\s+(\S+)\s*$/i);
      if (lim) { a = lim[1]; b = lim[2]; t = t.slice(0, lim.index); }
    } else if ((m = t.match(/^\s*(?:\\lim|lim(?:ite|it)?)\s*_?\s*\{?\s*\(?\s*([a-z])\s*(?:\\to|\\rightarrow|->|→|⟶|tende para|approaches)\s*([^}\s)]+?)\s*(\^\{?[+-]\}?|[+-](?=[})\s]))?\s*\)?\s*\}?/i))) {
      tipo = 'limite'; v = m[1]; a = m[2]; t = t.slice(m[0].length);
      if (m[3]) a += '';
    } else if (/(?<![<>!:])=(?!=)/.test(t)) tipo = 'equacao';
    let expr = ehLatex ? latexParaTexto(t) : t;
    expr = limpaFinal(unicodeParaTexto(expr));
    const conv = z => limpaFinal(unicodeParaTexto(ehLatex ? latexParaTexto(z) : z));
    return { tipo, expr, a: a ? conv(a).replace('∞', 'oo') : '', b: b ? conv(b) : '', var: v };
  }

  // "2x + y = 3" … → matriz ampliada
  function sistemaParaMatriz(eqs) {
    const vars = [...new Set(eqs.join(' ').match(/[a-z]/g) || [])].filter(c => c !== 'e').sort();
    if (!vars.length || vars.length > 6) return null;
    const linhas = [];
    for (const q of eqs) {
      const [esq, dir] = q.split('=');
      const coef = Object.fromEntries(vars.map(v => [v, 0])); let cte = 0;
      const termos = (s, sinal) => (s.replace(/\s/g, '').replace(/-/g, '+-').split('+').filter(Boolean)).forEach(tm => {
        const mm = tm.match(/^([+-]?[\d.\/]*)\*?([a-z])$/);
        if (mm) { const c = mm[1] === '' || mm[1] === '+' ? 1 : mm[1] === '-' ? -1 : eval(mm[1]); coef[mm[2]] += sinal * c; }
        else if (/^[+-]?[\d.\/]+$/.test(tm)) cte -= sinal * eval(tm);
        else throw new Error('não linear');
      });
      try { termos(esq, 1); termos(dir, -1); } catch (e) { return null; }
      linhas.push([...vars.map(v => coef[v]), cte].join(' '));
    }
    return linhas.join('\n');
  }

  window.interpretarColado = interpretar;
})();
