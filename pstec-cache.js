// PSTEC - cache local compartilhado (IndexedDB)
(function (global) {
    'use strict';

    const DB_NAME = 'PSTEC_APP_CACHE';
    const DB_VERSION = 1;
    const STORE_NAME = 'datasets';
    const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    function openDb() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in global)) {
                reject(new Error('IndexedDB não disponível neste navegador'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Falha ao abrir cache local'));
        });
    }

    async function read(key) {
        let db;
        try {
            db = await openDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error || new Error('Falha ao ler cache local'));
            });
        } finally {
            if (db) db.close();
        }
    }

    async function write(key, data, savedAt = new Date().toISOString()) {
        let db;
        try {
            db = await openDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put({ key, savedAt, data });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Falha ao gravar cache local'));
                tx.onabort = () => reject(tx.error || new Error('Gravação do cache interrompida'));
            });
            return savedAt;
        } finally {
            if (db) db.close();
        }
    }

    function formatDateTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function updateStatus(mode, savedAt = null, extra = '') {
        const badge = document.getElementById('dataStatusBadge');
        const dot = document.getElementById('dataStatusDot');
        const text = document.getElementById('dataStatusText');
        if (!badge || !dot || !text) return;

        const dt = formatDateTime(savedAt);
        const styles = {
            api: ['bg-emerald-500/15 border-emerald-300/40 text-emerald-100', 'bg-emerald-400', dt ? `API • ${dt}` : 'API • atualizado'],
            cache: ['bg-sky-500/15 border-sky-300/40 text-sky-100', 'bg-sky-400', dt ? `CACHE • ${dt}` : 'CACHE LOCAL'],
            updating: ['bg-amber-500/15 border-amber-300/40 text-amber-100', 'bg-amber-400 animate-pulse', 'SINCRONIZANDO...'],
            error: ['bg-red-500/15 border-red-300/40 text-red-100', 'bg-red-400', 'SEM CONEXÃO'],
            loading: ['bg-slate-500/20 border-slate-300/30 text-slate-100', 'bg-amber-400 animate-pulse', 'CARREGANDO...']
        };
        const cfg = styles[mode] || styles.loading;
        badge.className = `hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-black whitespace-nowrap ${cfg[0]}`;
        dot.className = `w-2 h-2 rounded-full ${cfg[1]}`;
        text.textContent = cfg[2];
        badge.title = extra || (mode === 'cache' ? 'Dados exibidos do cache local enquanto a API atualiza em segundo plano.' : mode === 'updating' ? 'Atualizando pela API sem bloquear a tela.' : 'Status dos dados');
    }

    global.PstecCache = {
        read,
        write,
        formatDateTime,
        updateStatus,
        AUTO_REFRESH_INTERVAL_MS
    };
})(window);
