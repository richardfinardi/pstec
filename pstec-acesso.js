/* PSTEC: controle visual de acesso por campos CSENHA.U_*.
   A autorizacao real dos dados depende de Depends(exigir_modulo(...)) nas APIs. */
(function () {
    'use strict';
    const CAMPOS = ['carteira','compras','producao','capital','financeiro','fat','indicadores','gestor'];
    const PAGINAS = {
        'producao.html': 'producao',
        'carteira.html': 'carteira',
        'compras.html': 'compras',
        'capital.html': 'capital',
        'financeiro.html': 'financeiro',
        'faturamento.html': 'fat',
        'indicadores-faturamento.html': 'indicadores',
        'dashboard.html': 'gestor',
        'conferencia-remocao.html': 'gestor',
        'gerenciar-acessos.html': 'gestor'
    };
    function habilitado(valor) {
        return valor === 1 || valor === true || String(valor).trim().toLowerCase() === '1' || String(valor).trim().toLowerCase() === 'true';
    }
    function decodeJwt(token) {
        try {
            const part = token.split('.')[1];
            if (!part) return null;
            const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (_) {
            return null;
        }
    }
    function limparSessao() {
        ['pstec_token','pstec_usuario_nome','pstec_perm_faturamento','pstec_perm_finalizacao','pstec_permissoes']
            .forEach(k => localStorage.removeItem(k));
    }
    const token = localStorage.getItem('pstec_token');
    const payload = token ? decodeJwt(token) : null;
    const pagina = decodeURIComponent(location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const paginaModulo = PAGINAS[pagina] || null;
    const paginaPrincipal = pagina === 'index.html' || pagina === '';
    if (!token || !payload || !payload.sub || !Number.isFinite(Number(payload.exp)) ||
        Number(payload.exp) * 1000 <= Date.now()) {
        limparSessao();
        document.documentElement.style.visibility = 'hidden';
        location.replace('login-pstec.html');
        return;
    }

    let permSalva = {};
    try { permSalva = JSON.parse(localStorage.getItem('pstec_permissoes') || '{}') || {}; }
    catch (_) { permSalva = {}; }
    // Preferir flags assinadas no JWT, com fallback para os campos retornados no login.
    const permissoes = {};
    for (const nome of CAMPOS) {
        const key = 'u_' + nome;
        permissoes[nome] = habilitado(Object.prototype.hasOwnProperty.call(payload, key)
            ? payload[key]
            : (permSalva[key] ?? permSalva[nome]));
    }
    const pode = modulo => permissoes.gestor || Boolean(permissoes[modulo]);
    if (paginaModulo && !pode(paginaModulo)) {
        document.documentElement.style.visibility = 'hidden';
        location.replace('index.html?acesso=negado');
        return;
    }

    function filtrarLinks() {
        document.querySelectorAll('a[href]').forEach(link => {
            let dest;
            try { dest = new URL(link.getAttribute('href'), location.href); } catch (_) { return; }
            if (dest.origin !== location.origin) return;
            const modulo = PAGINAS[decodeURIComponent(dest.pathname.split('/').pop()).toLowerCase()];
            if (modulo && !pode(modulo)) {
                link.hidden = true;
                link.style.setProperty('display', 'none', 'important');
            }
        });
        if (paginaPrincipal && location.search.includes('acesso=negado')) {
            const main = document.querySelector('main');
            if (main) {
                const aviso = document.createElement('div');
                aviso.setAttribute('role', 'alert');
                aviso.style.cssText = 'margin-bottom:16px;padding:12px 16px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:12px;font-weight:700;font-size:13px';
                aviso.textContent = 'Seu usuário não possui permissão para acessar o módulo solicitado.';
                main.prepend(aviso);
            }
            history.replaceState(null, '', location.pathname);
        }
    }
    window.PstecAcesso = Object.freeze({ permissoes, pode, limparSessao });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', filtrarLinks);
    else filtrarLinks();
})();
