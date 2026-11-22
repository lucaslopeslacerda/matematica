# -*- coding: utf-8 -*-
"""
Motor matemático do site "Matemática Passo a Passo".
Corre no browser através do Pyodide (SymPy 1.13.3).
Todas as funções públicas devolvem uma string JSON.
"""
import json
import math
import random
import re

import sympy as sp
from sympy import latex as _latex
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application,
    convert_xor,
)
from sympy.integrals import manualintegrate as mi

x, y, z, t, u_sym = sp.symbols('x y z t u')
TRANSF = standard_transformations + (implicit_multiplication_application, convert_xor)

# Nomes portugueses e alternativos -----------------------------------------
ALIASES = {
    'sen': sp.sin, 'tg': sp.tan, 'cotg': sp.cot, 'cotan': sp.cot,
    'arcsen': sp.asin, 'arcsin': sp.asin, 'arccos': sp.acos, 'arctg': sp.atan,
    'arctan': sp.atan, 'senh': sp.sinh, 'ln': sp.log, 'raiz': sp.sqrt,
    'e': sp.E, 'pi': sp.pi, 'inf': sp.oo, 'infinito': sp.oo, 'oo': sp.oo,
    'i': sp.I, 'abs': sp.Abs, 'log10': lambda a: sp.log(a, 10),
}
LOCAL = {'x': x, 'y': y, 'z': z, 't': t, 'u': u_sym}
LOCAL.update(ALIASES)


def _clean(s, virgula=True):
    s = s.strip()
    s = s.replace('·', '*').replace('×', '*').replace('÷', '/').replace('−', '-')
    s = s.replace('²', '^2').replace('³', '^3').replace('√', 'sqrt').replace('π', 'pi')
    s = s.replace('∞', 'oo')
    if virgula:
        s = re.sub(r'(?<=\d),(?=\d)', '.', s)  # 2,5 -> 2.5 (vírgula decimal)
    return s


def P(s, extra=None):
    """Converte texto em expressão SymPy."""
    d = dict(LOCAL)
    if extra:
        d.update(extra)
    e = parse_expr(_clean(s), local_dict=d, transformations=TRANSF, evaluate=True)
    return sp.nsimplify(e, rational=True) if e.has(sp.Float) else e


def L(e):
    """LaTeX de uma expressão, marcado com \x01…\x02 (vira $…$ nos textos e desaparece nas fórmulas)."""
    s = _latex(e)
    s = s.replace(r'\log', r'\ln').replace(r'\text{for}', r'\text{se}').replace(r'\text{otherwise}', r'\text{caso contrário}')
    return '\x01' + s + '\x02'


TEXTO = ('porque', 'titulo', 'pista', 'descricao', 'erro')


def _limpa(v, chave=''):
    if isinstance(v, str):
        if chave in TEXTO:
            return v.replace('\x01', '$').replace('\x02', '$')
        return v.replace('\x01', '').replace('\x02', '')
    if isinstance(v, dict):
        return {k: _limpa(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_limpa(x, chave) for x in v]
    return v


def ok(**kw):
    kw['ok'] = True
    return json.dumps(_limpa(kw), ensure_ascii=False)


def err(msg):
    return json.dumps(_limpa({'ok': False, 'erro': msg}), ensure_ascii=False)


class Passos:
    """Lista de passos ao estilo Symbolab."""

    def __init__(self):
        self.lista = []

    def add(self, titulo, latex, regra='', porque='', nivel=0, pista=''):
        self.lista.append({
            'titulo': titulo, 'latex': latex, 'regra': regra,
            'porque': porque, 'nivel': nivel, 'pista': pista or titulo,
        })


# ===================================================================
# GRÁFICOS – amostras de pontos para o desenhador em JavaScript
# ===================================================================
def amostra(expr, var=x, a=-10, b=10, n=500):
    if expr is None or not expr.free_symbols <= {var}:
        return None
    try:
        f = sp.lambdify(var, expr, modules=['math'])
    except Exception:
        return None
    pts = []
    for k in range(n + 1):
        xv = a + (b - a) * k / n
        try:
            yv = f(xv)
            if isinstance(yv, complex):
                yv = yv.real if abs(yv.imag) < 1e-9 else None
            if yv is not None and (math.isnan(yv) or math.isinf(yv) or abs(yv) > 1e6):
                yv = None
        except Exception:
            yv = None
        pts.append([xv, yv])
    return pts


def grafico(curvas, area=None, janela=None):
    a, b = (janela or (-6, 6))
    out = []
    for nome, e, cor in curvas:
        p = amostra(e, x, a, b)
        if p:
            out.append({'nome': nome, 'pontos': p, 'cor': cor})
    if not out:
        return None
    g = {'curvas': out, 'janela': [a, b]}
    if area:
        g['area'] = area
    return g


# ===================================================================
# DERIVADAS
# ===================================================================
def D(e, var=x):
    return sp.Derivative(e, var)


def LD(e, var=x):
    return r'\frac{d}{d%s}\left(%s\right)' % (L(var), L(e))


FUNC_DERIV = {
    sp.sin: (lambda a: sp.cos(a), r"(\sin u)' = \cos u \cdot u'", 'seno'),
    sp.cos: (lambda a: -sp.sin(a), r"(\cos u)' = -\sin u \cdot u'", 'cosseno'),
    sp.tan: (lambda a: 1 / sp.cos(a) ** 2, r"(\tan u)' = \frac{u'}{\cos^2 u}", 'tangente'),
    sp.cot: (lambda a: -1 / sp.sin(a) ** 2, r"(\cot u)' = -\frac{u'}{\sin^2 u}", 'cotangente'),
    sp.exp: (lambda a: sp.exp(a), r"(e^u)' = e^u \cdot u'", 'exponencial'),
    sp.log: (lambda a: 1 / a, r"(\ln u)' = \frac{u'}{u}", 'logaritmo'),
    sp.asin: (lambda a: 1 / sp.sqrt(1 - a ** 2), r"(\arcsin u)' = \frac{u'}{\sqrt{1-u^2}}", 'arco-seno'),
    sp.acos: (lambda a: -1 / sp.sqrt(1 - a ** 2), r"(\arccos u)' = -\frac{u'}{\sqrt{1-u^2}}", 'arco-cosseno'),
    sp.atan: (lambda a: 1 / (1 + a ** 2), r"(\arctan u)' = \frac{u'}{1+u^2}", 'arco-tangente'),
    sp.sinh: (lambda a: sp.cosh(a), r"(\sinh u)' = \cosh u \cdot u'", 'seno hiperbólico'),
    sp.cosh: (lambda a: sp.sinh(a), r"(\cosh u)' = \sinh u \cdot u'", 'cosseno hiperbólico'),
}


def dpassos(e, var, P_, nivel=0):
    """Deriva e regista passos. Devolve a derivada (não simplificada)."""
    if not e.has(var):
        P_.add('Derivada de uma constante', '%s = 0' % LD(e, var), r"(c)' = 0",
               'A expressão não depende de %s, por isso não varia: a derivada é 0.' % L(var), nivel)
        return sp.Integer(0)
    if e == var:
        P_.add('Derivada de %s' % L(var), '%s = 1' % LD(e, var), r"(x)' = 1",
               'A função identidade cresce sempre ao mesmo ritmo: declive 1.', nivel)
        return sp.Integer(1)

    # Soma
    if e.is_Add:
        termos = e.as_ordered_terms()
        soma = ' + '.join(LD(tm, var) for tm in termos)
        P_.add('Aplicar a regra da soma', '%s = %s' % (LD(e, var), soma), r"(f \pm g)' = f' \pm g'",
               'A derivada de uma soma é a soma das derivadas: derivamos cada termo separadamente.', nivel,
               pista='Divide em termos: deriva cada parcela em separado.')
        partes = [dpassos(tm, var, P_, nivel + 1) for tm in termos]
        res = sp.Add(*partes)
        P_.add('Juntar os resultados', '%s = %s' % (LD(e, var), L(res)), '', '', nivel)
        return res

    # Constante a multiplicar
    if e.is_Mul:
        c, resto = e.as_independent(var)
        if c != 1:
            P_.add('Tirar a constante para fora', '%s = %s \\cdot %s' % (LD(e, var), L(c), LD(resto, var)),
                   r"(c \cdot f)' = c \cdot f'", 'Uma constante a multiplicar mantém-se; só derivamos a parte que depende de %s.' % L(var), nivel)
            r = dpassos(resto, var, P_, nivel + 1)
            res = c * r
            P_.add('Multiplicar pela constante', '= %s' % L(res), '', '', nivel)
            return res
        num, den = sp.fraction(sp.together(e))
        if den.has(var) and num != 1:
            P_.add('Aplicar a regra do quociente',
                   r'%s = \frac{%s \cdot %s - %s \cdot %s}{\left(%s\right)^2}' % (
                       LD(e, var), LD(num, var), _par(den), _par(num), LD(den, var), L(den)),
                   r"\left(\frac{f}{g}\right)' = \frac{f'g - fg'}{g^2}",
                   'Temos uma divisão de duas funções de %s. Numerador: f = %s; denominador: g = %s.' % (L(var), L(num), L(den)),
                   nivel, pista='É uma divisão de funções: qual regra serve para quocientes?')
            dn = dpassos(num, var, P_, nivel + 1)
            dd = dpassos(den, var, P_, nivel + 1)
            res = (dn * den - num * dd) / den ** 2
            P_.add('Substituir na fórmula do quociente', '= %s' % L(res), '', '', nivel)
            return res
        fatores = e.as_ordered_factors()
        f = fatores[0]
        g = sp.Mul(*fatores[1:])
        P_.add('Aplicar a regra do produto',
               '%s = %s \\cdot %s + %s \\cdot %s' % (LD(e, var), LD(f, var), L(g), L(f), LD(g, var)),
               r"(f \cdot g)' = f' g + f g'",
               'Temos um produto de duas funções de %s: f = %s e g = %s.' % (L(var), L(f), L(g)), nivel,
               pista='É um produto de duas funções: qual regra usar?')
        df = dpassos(f, var, P_, nivel + 1)
        dg = dpassos(g, var, P_, nivel + 1)
        res = df * g + f * dg
        P_.add('Substituir na fórmula do produto', '= %s' % L(res), '', '', nivel)
        return res

    # Potências
    if e.is_Pow:
        b, ex = e.args
        if b.has(var) and not ex.has(var):
            interior = b
            if interior == var:
                res = ex * var ** (ex - 1)
                P_.add('Aplicar a regra da potência', '%s = %s' % (LD(e, var), L(res)), r"(x^n)' = n\,x^{n-1}",
                       'O expoente %s desce a multiplicar e o novo expoente fica %s.' % (L(ex), L(ex - 1)), nivel,
                       pista='Potência de x: o expoente desce e diminui uma unidade.')
                return res
            P_.add('Aplicar a regra da cadeia (potência)',
                   r"%s = %s\left(%s\right)^{%s} \cdot %s" % (LD(e, var), L(ex), L(interior), L(ex - 1), LD(interior, var)),
                   r"(u^n)' = n\,u^{n-1} \cdot u'",
                   'Função composta: a de fora é a potência ( )^{%s} e a de dentro é u = %s. Deriva-se a de fora e multiplica-se pela derivada da de dentro.' % (L(ex), L(interior)),
                   nivel, pista='Há uma função dentro da potência: regra da cadeia.')
            du = dpassos(interior, var, P_, nivel + 1)
            res = ex * interior ** (ex - 1) * du
            P_.add('Simplificar', '= %s' % L(res), '', '', nivel)
            return res
        if not b.has(var) and ex.has(var):
            if b == sp.E:
                return dpassos(sp.exp(ex), var, P_, nivel)
            P_.add('Aplicar a regra da exponencial de base a',
                   r"%s = %s \cdot \ln(%s) \cdot %s" % (LD(e, var), L(e), L(b), LD(ex, var)),
                   r"(a^u)' = a^u \ln(a) \cdot u'", 'A base %s é constante e o expoente depende de %s.' % (L(b), L(var)), nivel)
            du = dpassos(ex, var, P_, nivel + 1)
            res = e * sp.log(b) * du
            P_.add('Simplificar', '= %s' % L(res), '', '', nivel)
            return res
        # f(x)^g(x)
        novo = sp.exp(ex * sp.log(b))
        P_.add('Reescrever com a exponencial', r'%s = e^{%s}' % (L(e), L(ex * sp.log(b))),
               r"f^g = e^{g \ln f}", 'Base e expoente dependem de %s: reescrevemos como exponencial de base e (derivação logarítmica).' % L(var), nivel)
        r = dpassos(novo, var, P_, nivel + 1)
        return r

    # Funções elementares
    if isinstance(e, sp.Abs):
        a = e.args[0]
        P_.add('Derivada do valor absoluto', r"%s = \frac{%s}{%s} \cdot %s" % (LD(e, var), L(a), L(e), LD(a, var)),
               r"(|u|)' = \frac{u}{|u|} u'", 'Válido onde u ≠ 0.', nivel)
        da = dpassos(a, var, P_, nivel + 1)
        return a / e * da
    if e.func in FUNC_DERIV or isinstance(e, sp.exp):
        fn = sp.exp if isinstance(e, sp.exp) else e.func
        a = e.args[0]
        regra, formula, nome = FUNC_DERIV[fn]
        if fn == sp.log and len(e.args) > 1:
            a = e.args[0]
        fora = regra(a)
        if a == var:
            P_.add('Derivada da função %s' % nome, '%s = %s' % (LD(e, var), L(fora)), formula.replace("u'", '1').replace('u', 'x'),
                   'Derivada de referência (está na tabela de derivadas).', nivel)
            return fora
        P_.add('Aplicar a regra da cadeia', r"%s = %s \cdot %s" % (LD(e, var), L(fora), LD(a, var)), formula,
               'Função composta: a de fora é %s e a de dentro é u = %s. Deriva-se a de fora (mantendo u lá dentro) e multiplica-se pela derivada de u.' % (nome, L(a)),
               nivel, pista='Há uma função dentro de outra: regra da cadeia.')
        da = dpassos(a, var, P_, nivel + 1)
        res = fora * da
        P_.add('Simplificar', '= %s' % L(res), '', '', nivel)
        return res

    # Fallback
    res = sp.diff(e, var)
    P_.add('Calcular a derivada', '%s = %s' % (LD(e, var), L(res)), '', 'Cálculo direto.', nivel)
    return res


def _melhor(e):
    cands = [e]
    for f in (sp.simplify, lambda q: sp.factor(sp.together(q)), sp.trigsimp):
        try:
            cands.append(f(e))
        except Exception:
            pass
    return min(cands, key=lambda q: len(L(q)))


def derivada(expr_txt, var_txt='x', ordem=1):
    try:
        var = P(var_txt) if var_txt else x
        e = P(expr_txt)
        P_ = Passos()
        atual = e
        for k in range(int(ordem)):
            if ordem > 1:
                P_.add('Derivada de ordem %d' % (k + 1), LD(atual, var), '', '', 0)
            r = dpassos(atual, var, P_, 0 if ordem == 1 else 1)
            atual = _melhor(r)
        simp = atual
        bruto = r
        if sp.simplify(bruto - simp) == 0 and L(bruto) != L(simp):
            P_.add('Simplificar o resultado', '= %s' % L(simp), '', 'Juntar termos e simplificar.', 0)
        titulo = r'\frac{d%s}{d%s^{%d}}' % ('^{%d}' % ordem if ordem > 1 else '', L(var), ordem) if ordem > 1 else r'\frac{d}{d%s}' % L(var)
        g = grafico([('f(x)', e, '#2563eb'), ("f'(x)" if ordem == 1 else 'derivada', simp, '#dc2626')]) if var == x else None
        _guardar('derivada', simp, e, var)
        return ok(enunciado=r'%s\left(%s\right)' % (titulo, L(e)), resultado=L(simp), passos=P_.lista, grafico=g,
                  tema='derivadas')
    except Exception as ex:
        return err('Não consegui ler a expressão (%s).' % ex)


# ===================================================================
# INTEGRAIS
# ===================================================================
def LI(e, var):
    return r'\int %s\,d%s' % (_par(e), L(var))


def _par(e):
    s = L(e)
    return r'\left(%s\right)' % s if e.is_Add else s


def _ev(rule):
    try:
        return rule.eval()
    except Exception:
        return sp.integrate(rule.integrand, rule.variable)


NOMES_TRIG = {
    'SinRule': (r"\int \sin u\,du = -\cos u", 'seno'),
    'CosRule': (r"\int \cos u\,du = \sin u", 'cosseno'),
    'SecTanRule': (r"\int \sec u \tan u\,du = \sec u", 'sec·tan'),
    'CscCotRule': (r"\int \csc u \cot u\,du = -\csc u", 'csc·cot'),
    'Sec2Rule': (r"\int \sec^2 u\,du = \tan u", 'sec²'),
    'Csc2Rule': (r"\int \csc^2 u\,du = -\cot u", 'csc²'),
}


def ipassos(rule, P_, nivel=0, alternativas=None):
    nome = type(rule).__name__
    var = rule.variable
    ig = rule.integrand
    res = _ev(rule)
    eq = lambda: '%s = %s' % (LI(ig, var), L(res))

    if nome == 'AlternativeRule':
        alts = sorted(rule.alternatives, key=_custo)
        if alternativas is not None and len(alts) > 1:
            alternativas.extend(alts[1:])
        return ipassos(alts[0], P_, nivel, alternativas)
    if nome == 'ConstantRule':
        P_.add('Integral de uma constante', eq(), r"\int a\,dx = a\,x", 'Uma constante integra-se multiplicando-a pela variável.', nivel)
    elif nome == 'PowerRule':
        if rule.exp == -1:
            P_.add('Integral de 1/x', eq(), r"\int \frac{1}{x}dx = \ln|x|", 'Caso especial da potência: n = -1 dá o logaritmo.', nivel)
        else:
            P_.add('Aplicar a regra da potência', eq(), r"\int x^n dx = \frac{x^{n+1}}{n+1},\; n\neq -1",
                   'Soma-se 1 ao expoente (%s → %s) e divide-se pelo novo expoente.' % (L(rule.exp), L(rule.exp + 1)), nivel,
                   pista='Potência de x: aumenta o expoente e divide.')
    elif nome == 'ReciprocalRule':
        P_.add('Integral de 1/u', eq(), r"\int \frac{1}{u}du = \ln|u|", 'Primitiva de referência.', nivel)
    elif nome == 'ExpRule':
        if rule.base == sp.E:
            P_.add('Integral da exponencial', eq(), r"\int e^x dx = e^x", 'A exponencial de base e é a sua própria primitiva.', nivel)
        else:
            P_.add('Integral da exponencial de base a', eq(), r"\int a^x dx = \frac{a^x}{\ln a}", '', nivel)
    elif nome in NOMES_TRIG:
        f, n = NOMES_TRIG[nome]
        P_.add('Integral de referência (%s)' % n, eq(), f, 'Primitiva que está na tabela de primitivas.', nivel)
    elif nome in ('SqrtQuadraticRule',):
        P_.add('Integral de referência (raiz de uma quadrática)', eq(), r"\int \sqrt{a^2-x^2}dx = \frac{x\sqrt{a^2-x^2}}{2} + \frac{a^2}{2}\arcsin\frac{x}{a}",
               'Resulta de uma substituição trigonométrica (x = a·sen θ). Está nas tabelas de primitivas.', nivel)
    elif nome in ('ArctanRule', 'ArcsinRule', 'ArcsinhRule', 'ReciprocalSqrtQuadraticRule'):
        P_.add('Integral de referência (arco)', eq(), r"\int \frac{1}{1+x^2}dx=\arctan x,\quad \int \frac{1}{\sqrt{1-x^2}}dx=\arcsin x", '', nivel)
    elif nome == 'AddRule':
        termos = ' + '.join(LI(s.integrand, var) for s in rule.substeps)
        P_.add('Aplicar a regra da soma', '%s = %s' % (LI(ig, var), termos), r"\int (f \pm g) = \int f \pm \int g",
               'Integra-se cada termo separadamente.', nivel, pista='Separa o integral em vários integrais.')
        for s in rule.substeps:
            ipassos(s, P_, nivel + 1, alternativas)
        P_.add('Juntar os resultados', '= %s' % L(res), '', '', nivel)
    elif nome == 'ConstantTimesRule':
        P_.add('Tirar a constante para fora', r'%s = %s \cdot %s' % (LI(ig, var), L(rule.constant), LI(rule.other, var)),
               r"\int a\cdot f(x)dx = a \int f(x) dx", 'Uma constante a multiplicar pode sair do integral.', nivel)
        ipassos(rule.substep, P_, nivel + 1, alternativas)
        P_.add('Multiplicar pela constante', '= %s' % L(res), '', '', nivel)
    elif nome == 'URule':
        global u_sym
        guard = u_sym
        u_sym = U_NOMES[min(_prof_u(P_), 3)]
        uf = rule.u_func
        du = sp.diff(uf, var)
        novo = rule.substep.integrand.subs(rule.u_var, u_sym)
        P_.add('Aplicar substituição: %s = %s' % (L(u_sym), L(uf)),
               r'%s = %s \;\Rightarrow\; d%s = %s\,d%s \;\Rightarrow\; %s = \int %s\,d%s' % (L(u_sym), L(uf), L(u_sym), _par(du), L(var), LI(ig, var), _par(novo), L(u_sym)),
               r"\int f(g(x))\,g'(x)\,dx = \int f(u)\,du",
               'Escolhemos u = %s porque a sua derivada (%s) aparece, a menos de uma constante, no integral. Assim o integral fica mais simples, só em u.' % (L(uf), L(du)),
               nivel, pista='Procura uma função cuja derivada também aparece no integral.')
        sub = rule.substep
        ipassos(_renomear(sub, rule.u_var), P_, nivel + 1, alternativas)
        P_.add('Voltar a substituir %s = %s' % (L(u_sym), L(uf)), '= %s' % L(res), '', 'O resultado tem de ficar em função de %s.' % L(var), nivel)
        u_sym = guard
    elif nome == 'PartsRule':
        uu, dv = rule.u, rule.dv
        v = _ev(rule.v_step)
        du = sp.diff(uu, var)
        P_.add('Aplicar integração por partes',
               r'u = %s,\; dv = %s\,d%s \;\Rightarrow\; du = %s\,d%s,\; v = %s' % (L(uu), _par(dv), L(var), _par(du), L(var), L(v)),
               r"\int u\,dv = u\,v - \int v\,du",
               'Escolhemos u = %s (fica mais simples ao derivar) e dv = %s (fácil de integrar). Regra prática LIATE: Logaritmo, Inversa trig., Algébrica, Trigonométrica, Exponencial — o primeiro da lista costuma ser o u.' % (L(uu), L(dv)),
               nivel, pista='Produto de funções de tipos diferentes: integração por partes. Qual escolhes para u?')
        P_.add('Substituir na fórmula', r'%s = %s - \int %s\,d%s' % (LI(ig, var), L(uu * v), _par(v * du), L(var)), '', '', nivel)
        if rule.second_step is not None:
            ipassos(rule.second_step, P_, nivel + 1, alternativas)
        P_.add('Resultado da integração por partes', '= %s' % L(res), '', '', nivel)
    elif nome == 'CyclicPartsRule':
        P_.add('Integral cíclico: aplicar partes duas vezes', r'I = %s' % LI(ig, var), r"\int u\,dv = u\,v - \int v\,du",
               'Neste tipo de integral (exponencial × seno/cosseno), ao integrar por partes duas vezes o integral original volta a aparecer. Chamamos-lhe I e resolvemos uma equação em I.',
               nivel, pista='Exponencial × trigonométrica: integra por partes duas vezes e procura o integral inicial a reaparecer.')
        acum = 0
        sinal = 1
        for pr in rule.parts_rules:
            v = _ev(pr.v_step)
            du = sp.diff(pr.u, var)
            P_.add('Integração por partes', r'u = %s,\; dv = %s\,d%s \Rightarrow du = %s\,d%s,\; v = %s' % (L(pr.u), _par(pr.dv), L(var), _par(du), L(var), L(v)),
                   r"\int u\,dv = u\,v - \int v\,du", '', nivel + 1)
            acum += sinal * pr.u * v
            sinal = -sinal
        coef = rule.coefficient
        P_.add('O integral original reapareceu!', r'I = %s %s I' % (L(acum), '+' if coef > 0 else '-' if coef == -1 else '+ (%s)' % L(coef)),
               '', 'Este é o momento-chave: o lado direito contém de novo I. Passa-se I para o lado esquerdo.', nivel)
        P_.add('Isolar I', r'%s I = %s \;\Rightarrow\; I = %s' % (L(1 - coef), L(acum), L(res)), '',
               'Divide-se pelo coeficiente de I (aqui %s). É daí que vem a fração no resultado.' % L(1 - coef), nivel)
    elif nome == 'RewriteRule':
        P_.add('Reescrever a função', r'%s = %s' % (L(ig), L(rule.rewritten)), '',
               'Reescrevemos a expressão numa forma mais fácil de integrar (por exemplo, decomposição em frações simples ou identidade trigonométrica).', nivel,
               pista='Reescreve a função antes de integrar.')
        ipassos(rule.substep, P_, nivel + 1, alternativas)
    elif nome == 'PiecewiseRule':
        P_.add('Integral por ramos', eq(), '', 'O resultado depende de um parâmetro; integramos cada caso.', nivel)
    elif nome == 'DontKnowRule':
        r2 = sp.integrate(ig, var)
        P_.add('Calcular o integral', '%s = %s' % (LI(ig, var), L(r2)), '', 'Este integral não tem uma regra elementar que eu saiba mostrar passo a passo; o CAS calculou-o diretamente.', nivel)
        return r2
    else:
        P_.add('Aplicar regra (%s)' % nome.replace('Rule', ''), eq(), '', '', nivel)
        sub = getattr(rule, 'substep', None)
        if sub is not None:
            ipassos(sub, P_, nivel + 1, alternativas)
    return res


def _prof_u(P_):
    return sum(1 for p in P_.lista if p['titulo'].startswith('Aplicar substituição')) - sum(1 for p in P_.lista if p['titulo'].startswith('Voltar a substituir'))


def _custo(rule):
    Q = Passos()
    try:
        ipassos(rule, Q, 0)
    except Exception:
        return 999
    pen = sum(3 for p in Q.lista if p['titulo'].startswith('Aplicar substituição: u = \\ln'))
    return len(Q.lista) + pen


U_NOMES = [sp.Symbol('u'), sp.Symbol('w'), sp.Symbol('v'), sp.Symbol('s')]


def _renomear(rule, uvar):
    """Troca a variável auxiliar _u por u para mostrar bonito."""
    try:
        import dataclasses
        campos = {}
        for f in dataclasses.fields(rule):
            v = getattr(rule, f.name)
            if isinstance(v, sp.Basic):
                v = v.subs(uvar, u_sym)
            elif dataclasses.is_dataclass(v):
                v = _renomear(v, uvar)
            elif isinstance(v, list):
                v = [_renomear(i, uvar) if dataclasses.is_dataclass(i) else (i.subs(uvar, u_sym) if isinstance(i, sp.Basic) else i) for i in v]
            campos[f.name] = v
        return type(rule)(**campos)
    except Exception:
        return rule


def integral(expr_txt, var_txt='x', a_txt='', b_txt=''):
    try:
        var = P(var_txt) if var_txt else x
        e = P(expr_txt)
        P_ = Passos()
        alternativas = []
        regra = mi.integral_steps(e, var)
        F = ipassos(regra, P_, 0, alternativas)
        Fs = sp.simplify(F)
        novo_lixo = (Fs.has(sp.pi) and not F.has(sp.pi)) or (len(Fs.atoms(sp.Pow)) > len(F.atoms(sp.Pow)) + 1)
        if L(Fs) != L(F) and len(L(Fs)) < len(L(F)) and not novo_lixo:
            P_.add('Simplificar', '= %s' % L(Fs), '', '', 0)
            F = Fs
        definido = a_txt.strip() != '' and b_txt.strip() != ''
        metodos = []
        for alt in alternativas[:2]:
            Q = Passos()
            ipassos(alt, Q, 0)
            metodos.append({'nome': 'Método alternativo', 'passos': Q.lista})
        if definido:
            a, b = P(a_txt), P(b_txt)
            Fb, Fa = F.subs(var, b), F.subs(var, a)
            val = sp.simplify(Fb - Fa)
            P_.add('Aplicar os limites de integração (Teorema Fundamental do Cálculo)',
                   r'\int_{%s}^{%s} %s\,d%s = \Big[%s\Big]_{%s}^{%s} = %s - \left(%s\right) = %s' % (
                       L(a), L(b), _par(e), L(var), L(F), L(a), L(b), L(Fb), L(Fa), L(val)),
                   r"\int_a^b f(x)dx = F(b) - F(a)",
                   'Calcula-se a primitiva no limite superior e subtrai-se o valor no limite inferior. A constante C cancela.', 0,
                   pista='Usa F(b) − F(a).')
            num = sp.N(val)
            res = L(val) + ('' if val.is_Integer else r' \approx %s' % L(sp.Float(num, 6)) if num.is_real else '')
            area = None
            try:
                area = {'a': float(a), 'b': float(b)}
            except Exception:
                pass
            g = grafico([('f(x)', e, '#2563eb')], area=area) if var == x else None
            _guardar('valor', val, e, var)
            return ok(enunciado=r'\int_{%s}^{%s} %s\,d%s' % (L(a), L(b), _par(e), L(var)), resultado=res,
                      passos=P_.lista, grafico=g, metodos=metodos, tema='integrais')
        g = grafico([('f(x)', e, '#2563eb'), ('F(x) (primitiva)', F, '#16a34a')]) if var == x else None
        _guardar('primitiva', F, e, var)
        return ok(enunciado=LI(e, var), resultado=L(F) + ' + C', passos=P_.lista, grafico=g, metodos=metodos,
                  tema='integrais')
    except Exception as ex:
        return err('Não consegui resolver este integral (%s).' % ex)


# ===================================================================
# LIMITES
# ===================================================================
def _indet(v):
    return v is sp.nan or v.has(sp.zoo) or v is sp.zoo


def limite(expr_txt, var_txt='x', ponto_txt='0', lado=''):
    try:
        var = P(var_txt) if var_txt else x
        e = P(expr_txt)
        a = P(ponto_txt)
        dirtxt = {'+': '^+', '-': '^-'}.get(lado, '')
        enun = r'\lim_{%s \to %s%s} %s' % (L(var), L(a), dirtxt, L(e))
        P_ = Passos()
        dir_ = lado if lado in ('+', '-') else '+-'
        real = sp.limit(e, var, a, dir=dir_) if dir_ != '+-' else _lim2(e, var, a)
        num, den = sp.fraction(sp.together(e))
        if a.is_finite:
            sub = e.subs(var, a)
            if not _indet(sub) and sub.is_finite:
                P_.add('Substituição direta', r'%s = %s' % (enun, L(sp.simplify(sub))), r"\lim_{x\to a} f(x) = f(a)",
                       'A função é contínua em %s = %s, por isso basta substituir.' % (L(var), L(a)), 0,
                       pista='Experimenta substituir diretamente o valor.')
                return _fim_lim(enun, real, P_, e)
            nv, dv = num.subs(var, a), den.subs(var, a)
            if nv == 0 and dv == 0:
                P_.add('Substituir dá uma indeterminação', r'\frac{%s}{%s} \to \frac{0}{0}' % (L(num), L(den)), '',
                       'Ao substituir, numerador e denominador dão 0. "0/0" não é um número: temos de transformar a expressão.', 0,
                       pista='Substitui e vê que forma obténs.')
                fat = sp.cancel(e)
                if fat != e and not _indet(fat.subs(var, a)):
                    P_.add('Fatorizar e simplificar', r'%s = \frac{%s}{%s} = %s' % (L(e), L(sp.factor(num)), L(sp.factor(den)), L(fat)),
                           '', 'Ambos têm o fator (%s − %s), que pode ser cortado porque %s ≠ %s junto ao ponto.' % (L(var), L(a), L(var), L(a)), 0,
                           pista='Fatoriza numerador e denominador e procura um fator comum.')
                    P_.add('Substituir agora', r'%s = %s' % (enun, L(sp.simplify(fat.subs(var, a)))), '', '', 0)
                    return _fim_lim(enun, real, P_, e)
                return _lhopital(enun, num, den, var, a, real, P_, e)
            if dv == 0 and nv != 0:
                P_.add('Forma k/0', r'\frac{%s}{0}' % L(nv), '', 'Numerador ≠ 0 e denominador → 0: o limite é ±∞ (ou não existe, se os sinais laterais diferirem). Estuda-se o sinal de cada lado.', 0)
                return _fim_lim(enun, real, P_, e)
        else:
            # limite no infinito
            if num.is_polynomial(var) and den.is_polynomial(var) and den.has(var):
                gn, gd = sp.degree(num, var), sp.degree(den, var)
                maior = var ** max(gn, gd)
                P_.add('Dividir pelo termo de maior grau', r'\frac{%s}{%s}' % (L(sp.expand(num)), L(sp.expand(den))), '',
                       'Com %s → ∞, só os termos de maior grau importam: grau do numerador = %s, grau do denominador = %s.' % (L(var), gn, gd), 0,
                       pista='Compara os graus do numerador e do denominador.')
                ln = sp.LT(num, var) / sp.LT(den, var)
                P_.add('Ficar com os termos dominantes', r'%s = \lim %s' % (enun, L(sp.simplify(ln))), '', '', 0)
                return _fim_lim(enun, real, P_, e)
            if den.has(var) and sp.limit(num, var, a) in (sp.oo, -sp.oo) and sp.limit(den, var, a) in (sp.oo, -sp.oo):
                P_.add('Forma ∞/∞', r'\frac{\infty}{\infty}', '', 'Indeterminação: podemos usar a regra de L\'Hôpital.', 0)
                return _lhopital(enun, num, den, var, a, real, P_, e)
        P_.add('Calcular o limite', '%s = %s' % (enun, L(real)), '', '', 0)
        return _fim_lim(enun, real, P_, e)
    except Exception as ex:
        return err('Não consegui calcular o limite (%s).' % ex)


def _lim2(e, var, a):
    lp = sp.limit(e, var, a, '+')
    lm = sp.limit(e, var, a, '-')
    return lp if lp == lm else sp.nan


def _lhopital(enun, num, den, var, a, real, P_, e, k=0):
    dn, dd = sp.diff(num, var), sp.diff(den, var)
    P_.add('Aplicar a regra de L\'Hôpital', r'\lim \frac{%s}{%s} = \lim \frac{%s}{%s}' % (L(num), L(den), L(dn), L(dd)),
           r"\lim \frac{f}{g} = \lim \frac{f'}{g'} \;\text{(se for } \tfrac00 \text{ ou } \tfrac{\infty}{\infty})",
           'Deriva-se o numerador e o denominador separadamente (não é a regra do quociente!).', 0,
           pista='Indeterminação 0/0 ou ∞/∞: L\'Hôpital.')
    novo = dn / dd
    if a.is_finite:
        v = novo.subs(var, a)
        if (v.is_finite or v in (sp.oo, -sp.oo)) and not _indet(v) and k < 3:
            P_.add('Substituir', r'= %s' % L(sp.simplify(v)), '', '', 0)
            return _fim_lim(enun, real, P_, e)
        if k < 2 and dn.subs(var, a) == 0 and dd.subs(var, a) == 0:
            return _lhopital(enun, dn, dd, var, a, real, P_, e, k + 1)
    P_.add('Calcular o limite', r'= %s' % L(real), '', '', 0)
    return _fim_lim(enun, real, P_, e)


def _fim_lim(enun, real, P_, e):
    res = 'não existe' if real is sp.nan else L(real)
    if real is sp.nan:
        P_.add('Limites laterais diferentes', r'\text{O limite não existe}', '', 'Os limites à esquerda e à direita são diferentes.', 0)
    _guardar('valor', real, e, x)
    return ok(enunciado=enun, resultado=res if real is not sp.nan else r'\text{não existe}', passos=P_.lista,
              grafico=grafico([('f(x)', e, '#2563eb')]), tema='limites')


# ===================================================================
# EQUAÇÕES
# ===================================================================
def equacao(txt, var_txt='x'):
    try:
        var = P(var_txt) if var_txt else x
        if '=' in txt:
            esq, dir_ = txt.split('=', 1)
            E, Dr = P(esq), P(dir_)
        else:
            E, Dr = P(txt), sp.Integer(0)
        enun = '%s = %s' % (L(E), L(Dr))
        P_ = Passos()
        f = sp.expand(E - Dr)
        if Dr != 0:
            P_.add('Passar tudo para o mesmo membro', '%s = 0' % L(f), '', 'Subtrai-se o membro direito aos dois lados para ficar "= 0".', 0)
        num, den = sp.fraction(sp.together(f))
        if den.has(var):
            P_.add('Multiplicar pelo denominador', '%s = 0,\\quad %s \\neq 0' % (L(sp.expand(num)), L(den)), '',
                   'Uma fração é zero quando o numerador é zero (e o denominador não).', 0)
            f = sp.expand(num)
        sol = []
        if f.is_polynomial(var):
            g = sp.degree(f, var)
            if g == 1:
                a, b = sp.Poly(f, var).all_coeffs()
                P_.add('Equação do 1.º grau: isolar %s' % L(var), r'%s\,%s = %s' % (L(a), L(var), L(-b)), '',
                       'Passa-se o termo independente para o outro lado (troca de sinal).', 0, pista='Isola o x.')
                s = -b / a
                P_.add('Dividir por %s' % L(a), r'%s = %s' % (L(var), L(s)), '', '', 0)
                sol = [s]
            elif g == 2:
                a, b, c = sp.Poly(f, var).all_coeffs()
                disc = b ** 2 - 4 * a * c
                P_.add('Equação do 2.º grau: identificar a, b, c', r'a = %s,\; b = %s,\; c = %s' % (L(a), L(b), L(c)),
                       r'a x^2 + b x + c = 0', '', 0, pista='Usa a fórmula resolvente.')
                P_.add('Calcular o binómio discriminante', r'\Delta = b^2 - 4ac = %s' % L(disc), r'\Delta = b^2-4ac',
                       'Δ > 0: duas soluções reais; Δ = 0: uma solução; Δ < 0: sem soluções reais.', 0)
                sol = sp.solve(f, var)
                P_.add('Aplicar a fórmula resolvente', r'%s = \frac{-b \pm \sqrt{\Delta}}{2a} = \frac{%s \pm \sqrt{%s}}{%s}' % (L(var), L(-b), L(disc), L(2 * a)),
                       r'x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}', '', 0)
            else:
                fat = sp.factor(f)
                if fat != f:
                    P_.add('Fatorizar', '%s = 0' % L(fat), '', 'Um produto é zero quando algum dos fatores é zero (lei do anulamento do produto).', 0,
                           pista='Tenta fatorizar o polinómio.')
                sol = sp.solve(f, var)
        else:
            sol = sp.solve(f, var)
            P_.add('Resolver', ', '.join('%s = %s' % (L(var), L(s)) for s in sol) or r'\text{sem solução}', '', '', 0)
        if not sol:
            res = r'\text{Equação impossível em } \mathbb{R}' if f.is_polynomial(var) else r'\text{sem solução encontrada}'
        else:
            res = r',\;'.join('%s = %s' % (L(var), L(sp.nsimplify(s))) for s in sol)
            P_.add('Soluções', res, '', '', 0)
        _guardar('solucoes', sol, f, var)
        return ok(enunciado=enun, resultado=res, passos=P_.lista,
                  grafico=grafico([('membro esq. − dir.', f, '#2563eb')]) if var == x else None, tema='equacoes')
    except Exception as ex:
        return err('Não consegui resolver a equação (%s).' % ex)


# ===================================================================
# ÁLGEBRA LINEAR – método de Gauss
# ===================================================================
def _mat(txt):
    txt = txt.strip()
    if not txt.startswith('['):
        linhas = [l for l in re.split(r'[;\n]', txt) if l.strip()]
        rows = [[P(c) for c in re.split(r'[\s,]+', l.strip()) if c] for l in linhas]
    else:
        rows = [[P(str(c)) if not isinstance(c, (int, float)) else sp.nsimplify(c) for c in r] for r in json.loads(_clean(txt).replace("'", '"')) ] if '"' in txt or "'" in txt else eval_list(txt)
    return sp.Matrix(rows)


def eval_list(txt):
    rows = []
    for r in re.findall(r'\[([^\[\]]*)\]', txt):
        rows.append([P(c) for c in r.split(',') if c.strip()])
    return rows


def LM(M, aug=None):
    cols = M.shape[1]
    spec = 'c' * cols if aug is None else 'c' * aug + '|' + 'c' * (cols - aug)
    body = r' \\ '.join(' & '.join(L(M[i, j]) for j in range(cols)) for i in range(M.shape[0]))
    return r'\left[\begin{array}{%s} %s \end{array}\right]' % (spec, body)


def gauss(txt, aumentada=True):
    try:
        M = _mat(txt)
        m, n = M.shape
        aug = n - 1 if aumentada and n > 1 else None
        P_ = Passos()
        P_.add('Matriz inicial', LM(M, aug), '', 'Escreve-se a matriz %s do sistema.' % ('ampliada [A|b]' if aug else ''), 0)
        A = M.copy()
        r = 0
        ncols = aug if aug else n
        pivots = []
        for c in range(ncols):
            piv = None
            for i in range(r, m):
                if A[i, c] != 0:
                    piv = i
                    break
            if piv is None:
                continue
            if piv != r:
                A.row_swap(piv, r)
                P_.add(r'Trocar linhas: L_{%d} \leftrightarrow L_{%d}' % (r + 1, piv + 1), LM(A, aug), '',
                       'Precisamos de um elemento ≠ 0 na posição do pivô.', 0, pista='O pivô é zero: troca de linha.')
            pv = A[r, c]
            for i in range(r + 1, m):
                if A[i, c] != 0:
                    k = A[i, c] / pv
                    A[i, :] = A[i, :] - k * A[r, :]
                    A = A.applyfunc(sp.simplify)
                    P_.add(r'L_{%d} \leftarrow L_{%d} %s %s L_{%d}' % (i + 1, i + 1, '-' if k > 0 else '+', L(abs(k)) if abs(k) != 1 else '', r + 1),
                           LM(A, aug), '', 'Anula-se o elemento abaixo do pivô %s (coluna %d).' % (L(pv), c + 1), 0,
                           pista='Usa o pivô para criar zeros por baixo dele.')
            pivots.append((r, c))
            r += 1
            if r == m:
                break
        P_.add('Matriz em escada', LM(A, aug), '', 'Todos os elementos abaixo dos pivôs são zero.', 0)
        res = LM(A, aug)
        if aug:
            rA = sp.Matrix(M[:, :aug]).rank()
            rAb = M.rank()
            nv = aug
            vars_ = sp.symbols('x1:%d' % (nv + 1))
            if rA != rAb:
                clas = r'\text{Sistema impossível (SI)}'
                exp = 'car(A) = %d ≠ car(A|b) = %d: há uma equação do tipo 0 = k (k ≠ 0).' % (rA, rAb)
            elif rA == nv:
                clas = r'\text{Sistema possível e determinado (SPD)}'
                exp = 'car(A) = car(A|b) = número de incógnitas = %d: solução única.' % nv
            else:
                clas = r'\text{Sistema possível e indeterminado (SPI)}'
                exp = 'car(A) = car(A|b) = %d < %d incógnitas: infinitas soluções (grau de indeterminação %d).' % (rA, nv, nv - rA)
            P_.add('Classificar o sistema', clas, r'\text{car}(A) \text{ vs } \text{car}(A|b)', exp, 0)
            if rA == rAb:
                sol = sp.linsolve((sp.Matrix(M[:, :aug]), sp.Matrix(M[:, aug])), *vars_)
                s = list(sol)[0]
                txtsol = r',\; '.join('%s = %s' % (L(v), L(val)) for v, val in zip(vars_, s))
                P_.add('Substituição de trás para a frente', txtsol, '', 'Resolve-se a última equação e substitui-se nas anteriores.', 0)
                res = txtsol
            else:
                res = clas
        else:
            if m == n:
                d = M.det()
                P_.add('Determinante', r'\det = %s' % L(d), '', 'O determinante é o produto dos pivôs (com sinal trocado por cada troca de linhas).', 0)
        _guardar('matriz', A, None, x)
        return ok(enunciado=LM(M, aug), resultado=res, passos=P_.lista, grafico=None, tema='algebra-linear')
    except Exception as ex:
        return err('Não consegui ler a matriz. Escreve por exemplo: 1 2 3; 4 5 6 (%s)' % ex)


# ===================================================================
# CALCULADORA CAS
# ===================================================================
CAS_VARS = {}


def _matriz(*linhas):
    return sp.Matrix(linhas)


CAS_FUN = {
    'derivar': sp.diff, 'diff': sp.diff, 'derivada': sp.diff,
    'integrar': lambda f, v=x, a=None, b=None: sp.integrate(f, (v, a, b)) if a is not None else sp.integrate(f, v),
    'integrate': sp.integrate, 'integral': lambda f, v=x, a=None, b=None: sp.integrate(f, (v, a, b)) if a is not None else sp.integrate(f, v),
    'limite': sp.limit, 'limit': sp.limit,
    'resolver': lambda *a: sp.solve(*a), 'solve': sp.solve,
    'fatorizar': sp.factor, 'fatorar': sp.factor, 'factor': sp.factor,
    'expandir': sp.expand, 'expand': sp.expand, 'simplificar': sp.simplify, 'simplify': sp.simplify,
    'det': lambda M: sp.Matrix(M).det(), 'inv': lambda M: sp.Matrix(M).inv(), 'inversa': lambda M: sp.Matrix(M).inv(),
    'transposta': lambda M: sp.Matrix(M).T, 'car': lambda M: sp.Matrix(M).rank(), 'rank': lambda M: sp.Matrix(M).rank(),
    'matriz': _matriz, 'Matrix': sp.Matrix, 'valoresproprios': lambda M: sp.Matrix(M).eigenvals(),
    'taylor': lambda f, v=x, a=0, n=6: sp.series(f, v, a, n).removeO(),
    'series': sp.series, 'apart': sp.apart, 'fracoes': sp.apart, 'mdc': sp.gcd, 'mmc': sp.lcm,
    'somatorio': sp.summation, 'soma': sp.summation, 'produto': sp.product,
    'laplace': lambda f, tt=t, s=sp.Symbol('s'): sp.laplace_transform(f, tt, s, noconds=True),
    'ilaplace': lambda F, s=sp.Symbol('s'), tt=t: sp.inverse_laplace_transform(F, s, tt),
    'edo': lambda eq, ics='': _edo(eq, ics), 'dsolve': sp.dsolve, 'numerico': sp.N, 'N': sp.N,
    're': sp.re, 'im': sp.im, 'conj': sp.conjugate, 'arg': sp.arg, 'polar': lambda zz: (sp.Abs(zz), sp.arg(zz)),
    'Function': sp.Function, 'Eq': sp.Eq, 'oo': sp.oo, 'sqrt': sp.sqrt, 'binomial': sp.binomial, 'factorial': sp.factorial,
    's': sp.Symbol('s'), 'n': sp.Symbol('n'), 'k': sp.Symbol('k'), 'a': sp.Symbol('a'), 'b': sp.Symbol('b'), 'c': sp.Symbol('c'),
}


def _edo_expr(txt):
    yf = sp.Function('y')(x)
    txt = txt.replace("y'''", ' (__D3__)').replace("y''", ' (__D2__)').replace("y'", ' (__D1__)')
    d = dict(LOCAL)
    d.update({'__D3__': sp.Derivative(yf, x, 3), '__D2__': sp.Derivative(yf, x, 2), '__D1__': sp.Derivative(yf, x), 'y': yf})
    if '=' in txt:
        a, b = txt.split('=', 1)
        return sp.Eq(parse_expr(_clean(a), local_dict=d, transformations=TRANSF), parse_expr(_clean(b), local_dict=d, transformations=TRANSF))
    return sp.Eq(parse_expr(_clean(txt), local_dict=d, transformations=TRANSF), 0)


def _edo(eq, ics=''):
    """Resolve EDOs escritas com y, y', y''. Ex.: edo("y'' + y = 0", "y(0)=1, y'(0)=0")."""
    yf = sp.Function('y')
    eqs = _edo_expr(str(eq))
    cond = {}
    for c in [c for c in re.split(r',(?![^()]*\))', str(ics)) if c.strip()]:
        esq, val = c.split('=')
        esq = esq.strip()
        m = re.match(r"y('*)\((.+)\)", esq)
        ordem, ponto = len(m.group(1)), P(m.group(2))
        chave = yf(ponto) if ordem == 0 else sp.Derivative(yf(x), x, ordem).subs(x, ponto)
        cond[chave] = P(val)
    return sp.dsolve(eqs, yf(x), ics=cond or None)


# ---------------------------------------------------------------- Comandos ao estilo TI-Nspire CX CAS
class Saida:
    """Resultado já formatado em LaTeX (ex.: 'x = 2 ou x = 3')."""
    def __init__(self, latex):
        self.latex = latex


def _var_padrao(e):
    fs = sorted(getattr(e, 'free_symbols', set()), key=str)
    return x if x in fs or not fs else fs[0]


def _eq(e):
    return e if isinstance(e, sp.Equality) else sp.Eq(e, 0)


def ti_solve(eq, var=None, *extra):
    if isinstance(eq, (list, tuple)):
        eqs = [_eq(q) for q in eq]
        vs = list(var) if isinstance(var, (list, tuple)) else ([var] if var is not None else sorted(set().union(*[q.free_symbols for q in eqs]), key=str))
        sol = sp.solve(eqs, vs, dict=True)
        if not sol:
            return Saida(r'\text{false (sem solução)}')
        return Saida(r'\;\text{ ou }\;'.join(r'\left(' + r',\; '.join('%s = %s' % (L(k), L(v)) for k, v in d.items()) + r'\right)' for d in sol))
    eq = _eq(eq)
    var = var if var is not None else _var_padrao(eq)
    sol = sp.solve(eq, var)
    if not sol:
        return Saida(r'\text{false (sem solução)}')
    return Saida(r'\;\text{ ou }\;'.join('%s = %s' % (L(var), L(v)) for v in sol))


def ti_zeros(e, var=None):
    var = var if var is not None else _var_padrao(e)
    return list(sp.solve(_eq(e), var))


def ti_nsolve(eq, var=None, palpite=0):
    eq = _eq(eq)
    var = var if var is not None else _var_padrao(eq)
    return Saida('%s = %s' % (L(var), L(sp.nsolve(eq.lhs - eq.rhs, var, palpite))))


def ti_factor(e, var=None):
    if isinstance(e, sp.Integer) or (isinstance(e, sp.Basic) and e.is_Integer):
        f = sp.factorint(e)
        return Saida(r' \cdot '.join(('%d^{%d}' % (b, k) if k > 1 else '%d' % b) for b, k in sorted(f.items())) or '1')
    return sp.factor(e)


def ti_expand(e, var=None):
    if var is not None:
        return sp.apart(sp.together(e), var)
    return sp.expand(e)


def ti_taylor(f, var=x, n=5, a=0):
    return sp.series(f, var, a, int(n) + 1).removeO()


def _extremo(f, var, maximo):
    crit = [c for c in sp.solve(sp.diff(f, var), var) if c.is_real]
    if not crit:
        return Saida(r'\text{sem extremos}')
    vals = [(sp.simplify(f.subs(var, c)), c) for c in crit]
    alvo = max(vals, key=lambda t: float(t[0])) if maximo else min(vals, key=lambda t: float(t[0]))
    return Saida('%s = %s' % (L(var), L(alvo[1])))


def ti_tangente(f, var=x, a=0):
    m = sp.diff(f, var).subs(var, a)
    return sp.Eq(y, sp.expand(m * (var - a) + f.subs(var, a)))


def ti_normal(f, var=x, a=0):
    m = sp.diff(f, var).subs(var, a)
    return sp.Eq(y, sp.expand(-(var - a) / m + f.subs(var, a)))


def _lista(v):
    return list(v) if isinstance(v, (list, tuple, sp.Matrix)) else [v]


def ti_mean(v):
    v = _lista(v); return sp.nsimplify(sum(v)) / len(v)


def ti_median(v):
    v = sorted(_lista(v), key=float); n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def ti_var(v):
    v = _lista(v); m = ti_mean(v); return sum((t - m) ** 2 for t in v) / (len(v) - 1)


def ti_sum(e, k, a, b):
    return sp.summation(e, (k, a, b))


def ti_prod(e, k, a, b):
    return sp.product(e, (k, a, b))


def ti_ref(M):
    M = sp.Matrix(M)
    A = M.echelon_form()
    return A


def ti_eigvc(M):
    vecs = sp.Matrix(M).eigenvects()
    return Saida(r',\; '.join(r'\lambda = %s:\ %s' % (L(val), r',\ '.join(L(v.T) for v in vs)) for val, mult, vs in vecs))


TI_FUN = {
    'solve': ti_solve, 'resolver': ti_solve, 'zeros': ti_zeros, 'nSolve': ti_nsolve, 'nsolve': ti_nsolve,
    'factor': ti_factor, 'fatorizar': ti_factor, 'fatorar': ti_factor, 'expand': ti_expand, 'expandir': ti_expand,
    'comDenom': sp.together, 'propFrac': sp.apart, 'tExpand': sp.expand_trig, 'tCollect': sp.trigsimp,
    'approx': lambda e, n=10: sp.N(e, n), 'exact': lambda e: sp.nsimplify(e, rational=True),
    'floor': sp.floor, 'ceiling': sp.ceiling, 'round': lambda e, n=0: sp.Float(round(float(e), int(n))) if n else sp.Integer(round(float(e))),
    'mod': sp.Mod, 'gcd': sp.gcd, 'lcm': sp.lcm, 'nCr': sp.binomial, 'nPr': lambda n, r: sp.factorial(n) / sp.factorial(n - r),
    'derivative': sp.diff, 'd': sp.diff,
    'limit': lambda f, v=x, a=0, lado='+-': sp.limit(f, v, a, dir=str(lado).strip('"\'') or '+-'),
    'limite': lambda f, v=x, a=0, lado='+-': sp.limit(f, v, a, dir=str(lado).strip('"\'') or '+-'),
    'sum': ti_sum, 'soma': ti_sum, 'product': ti_prod,
    'fMin': lambda f, v=x: _extremo(f, v, False), 'fMax': lambda f, v=x: _extremo(f, v, True),
    'tangentLine': ti_tangente, 'normalLine': ti_normal, 'taylor': ti_taylor,
    'identity': sp.eye, 'ref': ti_ref, 'rref': lambda M: sp.Matrix(M).rref()[0], 'eigVl': lambda M: list(sp.Matrix(M).eigenvals(multiple=True)),
    'eigVc': ti_eigvc, 'dotP': lambda a, b: sp.Matrix(a).dot(sp.Matrix(b)), 'crossP': lambda a, b: sp.Matrix(a).cross(sp.Matrix(b)),
    'norm': lambda v: sp.sqrt(sum(t ** 2 for t in sp.Matrix(v))), 'simult': lambda A, b: sp.Matrix(A).LUsolve(sp.Matrix(b)),
    'conj': sp.conjugate, 'real': sp.re, 'imag': sp.im, 'angle': sp.arg,
    'mean': ti_mean, 'media': ti_mean, 'median': ti_median, 'mediana': ti_median, 'varSamp': ti_var,
    'stDevSamp': lambda v: sp.sqrt(ti_var(v)), 'max': sp.Max, 'min': sp.Min, 'sign': sp.sign,
    'log': lambda a, b=None: sp.log(a, b) if b is not None else sp.log(a, 10), 'ln': sp.log, 'sqrt': sp.sqrt,
    'root': lambda a, n=2: sp.root(a, n), 'abs': sp.Abs, 'Matrix': sp.Matrix, 'matriz': sp.Matrix,
    'derivPt': lambda f, v, a: sp.diff(f, v).subs(v, a), 'Piecewise': sp.Piecewise, 'piecewise': sp.Piecewise,
    'True': sp.true, 'sinh': sp.sinh, 'cosh': sp.cosh, 'tanh': sp.tanh,
}


def cas_vars():
    return ok(vars=[{'nome': k, 'valor': _lat_any(v)} for k, v in CAS_VARS.items()])


def _texto(r):
    if isinstance(r, Saida):
        return None
    try:
        if isinstance(r, sp.MatrixBase):
            return str(r.tolist()).replace(' ', '')
        t = sp.sstr(r).replace('**', '^').replace('I', 'i') if isinstance(r, sp.Basic) else None
        return t
    except Exception:
        return None


def _fecha(s, i):
    """índice do parêntese que fecha o que abre em s[i]."""
    par = {'(': ')', '[': ']'}
    pilha = []
    for j in range(i, len(s)):
        c = s[j]
        if c in '([':
            pilha.append(par[c])
        elif c in ')]':
            pilha.pop()
            if not pilha:
                return j
        elif c == '"':
            j2 = s.index('"', j + 1)
    return len(s) - 1


def _partes(s):
    out, nivel, cur, aspas = [], 0, '', False
    for c in s:
        if c == '"':
            aspas = not aspas
        if not aspas:
            if c in '([':
                nivel += 1
            elif c in ')]':
                nivel -= 1
        if c == ',' and nivel == 0 and not aspas:
            out.append(cur); cur = ''
        else:
            cur += c
    out.append(cur)
    return out


def _topo_igual(p):
    nivel, aspas = 0, False
    for i, c in enumerate(p):
        if c == '"':
            aspas = not aspas
        if aspas:
            continue
        if c in '([':
            nivel += 1
        elif c in ')]':
            nivel -= 1
        elif c == '=' and nivel == 0:
            ant = p[i - 1] if i else ''
            dep = p[i + 1] if i + 1 < len(p) else ''
            if ant not in '<>!=:' and dep != '=':
                return i
    return -1


def _ti_pre(s, topo=True):
    """Converte a sintaxe da TI: '=' dentro de argumentos → Eq(), 'and' → lista, {…} → […]."""
    s = s.replace('{', '[').replace('}', ']')
    out, i = '', 0
    while i < len(s):
        c = s[i]
        if c == '"':
            j = s.index('"', i + 1); out += s[i:j + 1]; i = j + 1; continue
        if c in '([':
            j = _fecha(s, i)
            dentro = s[i + 1:j]
            partes = []
            for p in _partes(dentro):
                p = _ti_pre(p, False)
                if re.search(r'\sand\s', p):
                    p = '[' + ','.join(re.split(r'\sand\s', p)) + ']'
                    p = _ti_pre(p, False)
                k = _topo_igual(p)
                if k >= 0:
                    p = 'Eq(%s,%s)' % (p[:k], p[k + 1:])
                partes.append(p)
            out += c + ','.join(partes) + s[j]
            i = j + 1
            continue
        out += c
        i += 1
    return out


def _desolve(linha):
    """deSolve(y''+y=0 and y(0)=1, x, y) → _edo."""
    m = re.match(r"^\s*deSolve\s*\((.*)\)\s*$", linha)
    if not m:
        return None
    args = _partes(m.group(1))
    partes = re.split(r'\sand\s', args[0])
    return _edo(partes[0].strip().strip('"'), ', '.join(p.strip() for p in partes[1:]))


def cas(linha):
    linha_orig = linha.strip()
    try:
        linha = _clean(linha, virgula=False)
        nome = None
        mf = re.match(r'^\s*([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*\)\s*:=\s*(.+)$', linha)
        if mf:
            fn, args, corpo = mf.group(1), [a.strip() for a in mf.group(2).split(',')], mf.group(3)
            dd = dict(LOCAL); dd.update(CAS_FUN); dd.update(TI_FUN); dd.update(CAS_VARS)
            syms = tuple(sp.Symbol(a_) for a_ in args)
            for a_, s_ in zip(args, syms):
                dd[a_] = s_
            expr = parse_expr(_ti_pre(corpo), local_dict=dd, transformations=TRANSF)
            CAS_VARS[fn] = sp.Lambda(syms, expr)
            return ok(entrada=linha_orig, saida=r'\text{Feito: } %s(%s) = %s' % (fn, ','.join(args), L(expr)), aprox='', sugestao=None, texto=None)
        m = re.match(r'^\s*([A-Za-z_]\w*)\s*:=\s*(.+)$', linha)
        if m:
            nome, linha = m.group(1), m.group(2)
        d = dict(LOCAL)
        d.update(CAS_FUN)
        d.update(TI_FUN)
        d.update(CAS_VARS)
        de = _desolve(linha)
        if de is not None:
            CAS_VARS['ans'] = de
            return ok(entrada=linha_orig, saida=_lat_any(de), aprox='', sugestao=None)
        # notação científica da TI (tecla EE): 10E-3 → (10*10^(-3)), exata
        linha = re.sub(r'(?<![\w.])(\d+(?:\.\d+)?)[Ee]([+-]?\d+)(?![\w.])', r'(\1*10^(\2))', linha)
        if not linha.lstrip().startswith('edo('):
            linha = _ti_pre(linha)
        sem_aspas = re.sub(r'"[^"]*"|\'[^\']*\'', '', linha)
        if '==' not in sem_aspas and _topo_igual(sem_aspas) >= 0 and not nome:
            esq, dr = linha.split('=', 1)
            r = ti_solve(sp.Eq(parse_expr(esq, local_dict=d, transformations=TRANSF), parse_expr(dr, local_dict=d, transformations=TRANSF)))
            entrada = r'%s = %s' % (L(parse_expr(esq, local_dict=d, transformations=TRANSF)), L(parse_expr(dr, local_dict=d, transformations=TRANSF)))
        else:
            r = parse_expr(linha, local_dict=d, transformations=TRANSF)
            entrada = _latex_entrada(linha, d)
        if isinstance(r, list) and r and all(isinstance(q, list) for q in r) and len(set(len(q) for q in r)) == 1:
            r = sp.Matrix(r)
        if isinstance(r, sp.Basic) and r.is_number and r.has(sp.I):
            r = sp.expand(r)
        if nome:
            CAS_VARS[nome] = r
        if not isinstance(r, Saida):
            CAS_VARS['ans'] = r
        saida = _lat_any(r)
        aprox = ''
        try:
            if isinstance(r, sp.Basic) and r.is_number and not r.is_Integer and r.is_finite and not r.has(sp.Float) and not r.has(sp.I):
                aprox = L(sp.N(r, 10))
        except Exception:
            pass
        sug = None if nome else _sugestao(_clean(linha_orig, virgula=False))
        return ok(entrada=linha_orig, saida=saida, aprox=aprox, sugestao=sug, texto=_texto(r))
    except Exception as ex:
        return err('Erro: %s' % ex)


def _latex_entrada(linha, d):
    try:
        e = parse_expr(linha, local_dict=d, transformations=TRANSF, evaluate=False)
        return L(e)
    except Exception:
        return r'\text{%s}' % linha.replace('_', r'\_')


def _lat_any(r):
    if isinstance(r, Saida):
        return r.latex
    if isinstance(r, bool):
        return r'\text{%s}' % ('true' if r else 'false')
    if isinstance(r, (list, tuple)):
        return r'\left\{%s\right\}' % r',\; '.join(_lat_any(i) for i in r) if r else r'\varnothing'
    if isinstance(r, dict):
        return r',\; '.join('%s: %s' % (_lat_any(k), _lat_any(v)) for k, v in r.items())
    try:
        return L(r)
    except Exception:
        return r'\text{%s}' % str(r)


def _sugestao(linha):
    m = re.match(r'^\s*(derivar|diff|derivada|derivative|integrar|integrate|integral|limite|limit|resolver|solve)\s*\((.*)\)\s*$', linha)
    if not m:
        return None
    f, args = m.group(1), m.group(2)
    partes = [a.strip('"\'') for a in _split_args(args)]
    if partes and (partes[0].startswith('[') or partes[0].startswith('{') or ' and ' in partes[0]):
        return None
    tipo = {'derivar': 'derivada', 'diff': 'derivada', 'derivada': 'derivada', 'integrar': 'integral', 'integrate': 'integral',
            'integral': 'integral', 'limite': 'limite', 'limit': 'limite', 'resolver': 'equacao', 'solve': 'equacao', 'derivative': 'derivada'}[f]
    return {'tipo': tipo, 'args': partes}


def _split_args(s):
    out, nivel, cur = [], 0, ''
    for ch in s:
        if ch in '([':
            nivel += 1
        elif ch in ')]':
            nivel -= 1
        if ch == ',' and nivel == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def cas_limpar():
    CAS_VARS.clear()
    return ok()


# ===================================================================
# MODO TREINO – verificar a resposta do aluno
# ===================================================================
ULTIMO = {}


def _guardar(tipo, valor, original, var):
    ULTIMO.clear()
    ULTIMO.update(tipo=tipo, valor=valor, original=original, var=var)


def verificar(txt):
    try:
        if not ULTIMO:
            return err('Resolve primeiro um exercício.')
        if not txt.strip():
            return err('Escreve primeiro a tua resposta.')
        tipo, alvo, var = ULTIMO['tipo'], ULTIMO['valor'], ULTIMO['var']
        if tipo == 'solucoes':
            dados = [P(s.split('=')[-1]) for s in re.split(r'[;]|\bou\b', txt) if s.strip()]
            certo = set(sp.simplify(d) for d in dados) == set(sp.simplify(a) for a in alvo)
        elif tipo == 'matriz':
            return err('No Gauss, compara a tua matriz com os passos.')
        else:
            v = P(txt.replace('+ C', '').replace('+C', ''))
            if tipo == 'primitiva':
                certo = sp.simplify(sp.diff(v - alvo, var)) == 0
            else:
                certo = sp.simplify(v - alvo) == 0
                if not certo:
                    try:
                        certo = all(abs(complex(sp.N((v - alvo).subs(var, val)))) < 1e-9 for val in (0.37, 1.3, 2.71))
                    except Exception:
                        pass
        return ok(certo=bool(certo))
    except Exception as ex:
        return err('Não consegui ler a tua resposta (%s).' % ex)


# ===================================================================
# "DÁ-ME OUTRO IGUAL" – gerar exercício parecido
# ===================================================================
def parecido(tipo, expr_txt):
    """Troca os números inteiros da expressão por outros parecidos."""
    for _ in range(25):
        def troca(mm):
            n = int(mm.group(0))
            if n <= 1:
                return mm.group(0)
            novo = random.choice([k for k in range(2, max(4, n + 4)) if k != n] or [n + 1])
            return str(novo)
        novo = re.sub(r'(?<![\w.])\d+(?![\w.])', troca, expr_txt)
        if novo == expr_txt:
            # sem números: troca a função
            subs = [('sin', 'cos'), ('cos', 'sin'), ('exp', 'sin'), ('ln', 'sqrt')]
            for a_, b_ in subs:
                if a_ in expr_txt:
                    novo = expr_txt.replace(a_, b_, 1)
                    break
            else:
                novo = '2*(' + expr_txt + ')'
        try:
            e = P(novo)
            if tipo == 'integral':
                st = mi.integral_steps(e, x)
                if type(st).__name__ == 'DontKnowRule':
                    continue
            return ok(expressao=novo)
        except Exception:
            continue
    return ok(expressao=expr_txt)


# ===================================================================
# Pré-visualização do que o aluno escreve
# ===================================================================
def previsualizar(txt):
    try:
        if '=' in txt and '==' not in txt:
            a, b = txt.split('=', 1)
            return ok(latex='%s = %s' % (L(P(a)), L(P(b))))
        return ok(latex=L(parse_expr(_clean(txt), local_dict=LOCAL, transformations=TRANSF, evaluate=False)))
    except Exception:
        return ok(latex='')


def resolver(tipo, a='', b='', c='', d=''):
    if tipo == 'derivada':
        return derivada(a, b or 'x', int(c or 1))
    if tipo == 'integral':
        return integral(a, b or 'x', c, d)
    if tipo == 'limite':
        return limite(a, b or 'x', c or '0', d)
    if tipo == 'equacao':
        return equacao(a, b or 'x')
    if tipo == 'gauss':
        return gauss(a, b != 'nao')
    return err('Tipo desconhecido')
