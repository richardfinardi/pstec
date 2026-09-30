(() => {
  'use strict';

  const API = 'https://pstec.consultoriarf.net/carteira';
  const VALUE_COLS = new Set(['Vl. Unitário','Vl. Total','Vl. a faturar','Vl. Liberado','Valor fat. disp.','Vl. Lucro','Margem Lucro','Valor falta comprar']);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const auth = extra => typeof getPstecAuthHeaders === 'function' ? getPstecAuthHeaders(extra || {}) : Object.assign({'Authorization':'Bearer '+(localStorage.getItem('pstec_token')||'')}, extra||{});

  function rowKey(item){
    return [item?._cod_empresa,item?._cod_orcamento,item?.['Nº Orçamento'],item?.['Código'],item?.Item]
      .map(v=>String(v??'').trim()).join('\u001f');
  }
  function rowKeyCounts(){
    const out={};
    (typeof currentFilteredData!=='undefined'?currentFilteredData:[]).forEach(r=>{const k=rowKey(r);out[k]=(out[k]||0)+1});
    return out;
  }
  function visibleDefault(col){ return col.tableKey ? !(typeof hiddenTableCols!=='undefined' && hiddenTableCols.has(col.tableKey)) : true; }
  function modal(id,show){const m=document.getElementById(id);if(!m)return;m.classList.toggle('hidden',!show);m.classList.toggle('flex',show);if(show)lucide.createIcons();}
  async function copy(text){try{await navigator.clipboard.writeText(text)}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}}
  const dt = v => { if(!v)return '-'; const d=new Date(v); return Number.isNaN(d.getTime())?'-':d.toLocaleString('pt-BR'); };

  function inject(){
    if(document.getElementById('portalCreateModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="portalCreateModal" class="fixed inset-0 bg-slate-900/65 backdrop-blur-sm hidden items-center justify-center p-4 z-[95]">
        <div class="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
          <div class="bg-pstec-700 px-5 py-4 text-white flex justify-between items-center"><div><b class="text-sm">Gerar Portal da Carteira</b><p class="text-[10px] text-pstec-100">Compartilha somente os itens filtrados agora.</p></div><button onclick="PstecPortal.closeCreate()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
          <div class="p-5 overflow-y-auto custom-scroll space-y-4">
            <div class="grid sm:grid-cols-3 gap-3"><div class="sm:col-span-2"><label class="text-[10px] font-black uppercase text-slate-500">Nome</label><input id="portalName" class="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold" maxlength="120"></div><div><label class="text-[10px] font-black uppercase text-slate-500">Validade</label><select id="portalValidity" class="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="0">Sem vencimento</option></select></div></div>
            <div class="grid sm:grid-cols-3 gap-3"><div class="bg-pstec-50 border border-pstec-100 rounded-2xl p-3"><span class="text-[9px] font-black uppercase text-slate-500 block">Itens</span><strong id="portalCount" class="text-xl text-pstec-700">0</strong></div><label class="bg-slate-50 border rounded-2xl p-3 flex gap-2 items-center cursor-pointer"><input id="portalValues" type="checkbox" onchange="PstecPortal.renderCols()"><span><b class="text-xs block">Mostrar valores</b><small class="text-[10px] text-slate-500">R$, lucro e margem</small></span></label><label class="bg-slate-50 border rounded-2xl p-3 flex gap-2 items-center cursor-pointer"><input id="portalExcel" type="checkbox"><span><b class="text-xs block">Permitir Excel</b><small class="text-[10px] text-slate-500">Download pelo cliente</small></span></label></div>
            <div><div class="flex justify-between mb-2"><div><b class="text-[10px] uppercase text-slate-500">Colunas do portal</b><p class="text-[10px] text-slate-400">Começa pelas colunas visíveis da tabela.</p></div><div class="text-[10px] font-bold flex gap-2"><button onclick="PstecPortal.allCols(true)" class="text-pstec-700">Marcar todas</button><button onclick="PstecPortal.allCols(false)" class="text-red-600">Desmarcar</button></div></div><div id="portalCols" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-60 overflow-y-auto custom-scroll bg-slate-50 border rounded-2xl p-3"></div></div>
            <div id="portalError" class="hidden bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-bold"></div>
            <div id="portalResult" class="hidden bg-emerald-50 border border-emerald-200 rounded-xl p-3"><b class="text-xs text-emerald-800">Portal criado</b><div class="flex gap-2 mt-2"><input id="portalUrl" readonly class="flex-1 bg-white border rounded-xl px-3 py-2 text-[11px] font-mono"><button onclick="PstecPortal.copyGenerated()" class="px-3 bg-pstec-700 text-white rounded-xl"><i data-lucide="copy" class="w-4 h-4"></i></button><button onclick="PstecPortal.openGenerated()" class="px-3 bg-emerald-600 text-white rounded-xl"><i data-lucide="external-link" class="w-4 h-4"></i></button></div></div>
          </div>
          <div class="px-5 py-3 border-t bg-slate-50 flex justify-between gap-2"><button onclick="PstecPortal.openManager()" class="px-4 py-2 bg-white border rounded-xl text-pstec-700 text-xs font-black">Gerenciar Portais</button><div class="flex gap-2"><button onclick="PstecPortal.closeCreate()" class="px-4 py-2 bg-white border rounded-xl text-xs font-bold">Fechar</button><button id="portalCreateBtn" onclick="PstecPortal.create()" class="px-5 py-2 bg-cyan-600 text-white rounded-xl text-xs font-black">Gerar Link</button></div></div>
        </div>
      </div>
      <div id="portalManagerModal" class="fixed inset-0 bg-slate-900/65 backdrop-blur-sm hidden items-center justify-center p-4 z-[100]">
        <div class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col"><div class="bg-pstec-800 px-5 py-4 text-white flex justify-between"><div><b class="text-sm">Portais da Carteira</b><p class="text-[10px] text-pstec-100">Copie ou desative os links.</p></div><button onclick="PstecPortal.closeManager()"><i data-lucide="x" class="w-5 h-5"></i></button></div><div id="portalManagerBody" class="p-5 overflow-y-auto custom-scroll"></div></div>
      </div>`);
  }

  function renderCols(){
    const box=document.getElementById('portalCols'); if(!box)return;
    const show=document.getElementById('portalValues')?.checked;
    const previous=new Set([...box.querySelectorAll('.portal-col:checked')].map(x=>x.value));
    const first=box.dataset.done!=='1';
    box.innerHTML=(typeof exportableColsConfig!=='undefined'?exportableColsConfig:[]).filter(c=>c.id!=='col_AcaoIndex').map(c=>{
      const disabled=VALUE_COLS.has(c.id)&&!show;
      const checked=!disabled&&(first?visibleDefault(c):previous.has(c.id));
      return `<label class="flex gap-2 items-center p-2 rounded-lg ${disabled?'opacity-40':'hover:bg-white cursor-pointer'}"><input class="portal-col" type="checkbox" value="${esc(c.id)}" ${checked?'checked':''} ${disabled?'disabled':''}><span class="text-[11px] font-semibold">${esc(c.label)}</span></label>`;
    }).join('');
    box.dataset.done='1';
  }

  function openCreate(){
    inject(); const rows=(typeof currentFilteredData!=='undefined'?currentFilteredData:[]); if(!rows.length)return alert('Não há registros filtrados para publicar.');
    const clients=[...new Set(rows.map(r=>String(r.Cliente||'').trim()).filter(Boolean))];
    document.getElementById('portalName').value=clients.length===1?`${clients[0]} — Carteira`:`Carteira — ${rows.length} itens`;
    document.getElementById('portalCount').textContent=rows.length.toLocaleString('pt-BR');
    document.getElementById('portalValues').checked=false; document.getElementById('portalExcel').checked=false;
    document.getElementById('portalCols').dataset.done='0'; document.getElementById('portalError').classList.add('hidden'); document.getElementById('portalResult').classList.add('hidden'); renderCols(); modal('portalCreateModal',true);
  }

  async function create(){
    const err=document.getElementById('portalError'), btn=document.getElementById('portalCreateBtn'); err.classList.add('hidden');
    const nome=document.getElementById('portalName').value.trim(); const cols=[...document.querySelectorAll('.portal-col:checked')].map(x=>x.value);
    if(!nome||!cols.length){err.textContent=!nome?'Informe um nome.':'Selecione pelo menos uma coluna.';err.classList.remove('hidden');return}
    btn.disabled=true; btn.textContent='Gerando...';
    try{
      const r=await fetch(`${API}/portal`,{method:'POST',cache:'no-store',headers:auth({'Content-Type':'application/json'}),body:JSON.stringify({nome,validade_dias:+document.getElementById('portalValidity').value,mostrar_valores:document.getElementById('portalValues').checked,permitir_excel:document.getElementById('portalExcel').checked,colunas:cols,row_keys:rowKeyCounts()})});
      const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.detail||`HTTP ${r.status}`);
      document.getElementById('portalUrl').value=d.portal?.url||''; document.getElementById('portalResult').classList.remove('hidden'); lucide.createIcons();
    }catch(e){err.textContent=e.message||'Erro ao gerar portal.';err.classList.remove('hidden')}finally{btn.disabled=false;btn.textContent='Gerar Link'}
  }

  async function openManager(){
    inject(); modal('portalCreateModal',false); modal('portalManagerModal',true); const box=document.getElementById('portalManagerBody'); box.innerHTML='<div class="py-10 text-center text-slate-400">Carregando...</div>';
    try{
      const r=await fetch(`${API}/portais`,{cache:'no-store',headers:auth({'Cache-Control':'no-cache'})}); const list=await r.json().catch(()=>[]); if(!r.ok)throw new Error(list.detail||`HTTP ${r.status}`);
      if(!Array.isArray(list)||!list.length){box.innerHTML='<div class="py-12 text-center text-slate-400 text-xs font-bold">Nenhum portal criado.</div>';return}
      box.innerHTML='<div class="space-y-2">'+list.map(p=>`<div class="border rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${p.ativo?'bg-white':'bg-slate-50 opacity-75'}"><div><div class="flex gap-2 items-center"><b class="text-xs">${esc(p.nome||p.id)}</b><span class="px-2 py-0.5 rounded-full text-[9px] font-black ${p.ativo?'bg-emerald-100 text-emerald-800':'bg-red-100 text-red-700'}">${p.ativo?'ATIVO':'DESATIVADO'}</span></div><div class="text-[10px] text-slate-500 mt-1">${Number(p.qtd_itens||0).toLocaleString('pt-BR')} itens · validade ${esc(p.validade_ate?dt(p.validade_ate):'sem vencimento')} · ${Number(p.qtd_acessos||0)} acessos</div></div><div class="flex gap-1"><button data-copy="${encodeURIComponent(p.url||'')}" class="portal-copy px-2 py-1.5 bg-pstec-50 text-pstec-700 rounded-lg text-[10px] font-black">Copiar</button><button data-open="${encodeURIComponent(p.url||'')}" class="portal-open px-2 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black">Abrir</button><button data-id="${esc(p.id)}" data-active="${p.ativo?'0':'1'}" class="portal-toggle px-2 py-1.5 ${p.ativo?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'} rounded-lg text-[10px] font-black">${p.ativo?'Desativar':'Reativar'}</button></div></div>`).join('')+'</div>';
      box.querySelectorAll('.portal-copy').forEach(b=>b.onclick=()=>copy(decodeURIComponent(b.dataset.copy)));
      box.querySelectorAll('.portal-open').forEach(b=>b.onclick=()=>window.open(decodeURIComponent(b.dataset.open),'_blank','noopener'));
      box.querySelectorAll('.portal-toggle').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,b.dataset.active==='1'));
    }catch(e){box.innerHTML=`<div class="py-10 text-center text-red-600 text-xs font-black">${esc(e.message)}</div>`}
  }

  async function setStatus(id,ativo){
    try{const r=await fetch(`${API}/portal/${encodeURIComponent(id)}/status`,{method:'PATCH',cache:'no-store',headers:auth({'Content-Type':'application/json'}),body:JSON.stringify({ativo})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||`HTTP ${r.status}`);await openManager()}catch(e){alert(e.message||'Erro ao alterar portal.')}
  }

  window.PstecPortal={
    openCreate, closeCreate:()=>modal('portalCreateModal',false), renderCols,
    allCols:v=>document.querySelectorAll('.portal-col:not(:disabled)').forEach(c=>c.checked=v),
    create, copyGenerated:()=>copy(document.getElementById('portalUrl')?.value||''),
    openGenerated:()=>{const u=document.getElementById('portalUrl')?.value;if(u)window.open(u,'_blank','noopener')},
    openManager, closeManager:()=>modal('portalManagerModal',false)
  };
  document.addEventListener('DOMContentLoaded',inject);
})();
