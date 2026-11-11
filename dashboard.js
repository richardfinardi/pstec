(function () {
'use strict';
var ROOT = 'https://pstec.consultoriarf.net/';
var SOURCES = {
  producao: {path:'producao',cache:'pstec_producao_data_v1',name:'Produção'},
  carteira: {path:'CARTEIRA',cache:'pstec_carteira_data_v1',name:'Carteira'},
  faturamento: {path:'faturamento',cache:'pstec_faturamento_bi_v1',name:'Faturamento'},
  capital: {path:'capital_carteira',cache:'pstec_capital_carteira_v3',name:'Capital'},
  pagar: {path:'financeiro_pagar',cache:'pstec_financeiro_analitico_v1_pagar',name:'A pagar'},
  receber: {path:'financeiro_receber',cache:'pstec_financeiro_analitico_v1_receber',name:'A receber'},
  indicadores: {path:'faturamento_indicadores',cache:'pstec_faturamento_indicadores_v1',name:'Pontualidade'},
  materiais: {path:'01_compras_materiais',cache:'pstec_dashboard_materiais_v1',name:'Materiais'},
  ocs: {path:'03_compras_ocs',cache:'pstec_dashboard_ocs_v1',name:'Ordens de compra'}
};
var names=Object.keys(SOURCES),data={},status={},charts={};
var fetching=false,lastStart=0,renderTimer=null;
var monthEl=document.getElementById('referenceMonth');
var storedMonth=localStorage.getItem('pstec_dashboard_mes');
var today=new Date();
var defaultMonth=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
monthEl.value=/^\d{4}-\d{2}$/.test(storedMonth||'')?storedMonth:defaultMonth;
names.forEach(function(k){data[k]=[];status[k]={ready:false,live:false,savedAt:null,error:null};});
var brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
var integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});

var HELP_DEFINITIONS = {"k_fat":{"title":"Faturamento do mês","detail":"Soma dos valores faturados com data de emissão no mês selecionado. Considera VENDA DE PRODUTOS, VENDA DE SERVIÇOS e VENDA DE SUCATA quando essas contas são identificadas. Se nenhuma dessas contas aparecer no retorno, considera os registros válidos disponíveis, seguindo a regra atual do painel.","source":"Fonte: /faturamento. Período: mês selecionado."},"k_carteira":{"title":"Carteira a faturar","detail":"Soma do campo 'Vl. a faturar' dos itens com Status OS = APROVADO e Saldo a entregar maior que zero. É a posição atual da carteira, sem limitar ao mês selecionado.","source":"Fonte: /CARTEIRA. Posição atual."},"k_capital":{"title":"Capital necessário","detail":"Para cada item aprovado com saldo a entregar, calcula (Cotação Prata Atual × Qtde. AG por pedido × 1,15) + Vl. MP comum + Impostos a pagar. Depois soma os resultados. É capital estimado para atender a carteira, não saldo bancário.","source":"Fonte: /capital_carteira. Posição atual."},"k_saldo":{"title":"Saldo financeiro","detail":"Contas a receber menos contas a pagar, considerando vencimentos do mês escolhido e títulos em aberto ou parciais, sem previsão. Não representa o saldo bancário, pois não inclui saldo inicial.","source":"Fontes: /financeiro_receber e /financeiro_pagar. Vencimento no mês selecionado."},"k_os":{"title":"OS em produção","detail":"Quantidade de OS que não estão no limbo e não possuem status FINALIZADO, CONCLUÍDO nem 100%. É a posição atual da produção, não apenas do mês selecionado.","source":"Fonte: /producao. Posição atual."},"k_atrasadas":{"title":"OS atrasadas","detail":"Conta, entre as OS em produção, aquelas sinalizadas pela API como atrasadas (campo 'atrasada' = SIM, S, 1 ou TRUE). Exclui as finalizadas e as OS no limbo.","source":"Fonte: /producao. Posição atual."},"k_compras":{"title":"Materiais sem OC","detail":"Conta materiais distintos por empresa, OS, OS auxiliar e GUID da lista, já processados e com quantidade solicitada maior que zero, mas sem ordem de compra vinculada. Exclui destino 3, família 22 e produtos inativos.","source":"Fontes: /01_compras_materiais e /03_compras_ocs. Posição atual."},"k_pontualidade":{"title":"Pontualidade de faturamento","detail":"Percentual de unidades faturadas dentro do prazo sobre todas as unidades com prazo classificado. 'DENTRO DO PRAZO' e 'PARCIAL NO PRAZO' contam como pontuais. 'FORA DO PRAZO' e 'PARCIAL EM ATRASO' entram no denominador como atrasadas.","source":"Fonte: /faturamento_indicadores. Data de emissão no mês escolhido."},"s_pagar":{"title":"Contas a pagar no mês","detail":"Soma dos saldos rateados de títulos em aberto ou parciais, efetivos (previsão = 0), com vencimento no mês selecionado. Valores já pagos não entram nesse saldo.","source":"Fonte: /financeiro_pagar. Mês de vencimento."},"s_receber":{"title":"Contas a receber no mês","detail":"Soma dos saldos ainda a receber de títulos em aberto ou parciais, efetivos (previsão = 0), com vencimento no mês selecionado. Valores recebidos já não entram nesse saldo.","source":"Fonte: /financeiro_receber. Mês de vencimento."},"s_naoprocessado":{"title":"Materiais não processados","detail":"Quantidade de materiais distintos cujo campo processado é diferente de 1, excluindo destino 3, família 22 e itens inativos. Apresenta a posição atual das listas.","source":"Fonte: /01_compras_materiais. Posição atual."},"chartMonthly":{"title":"Evolução financeira","detail":"Seis meses, até o mês selecionado. Azul: faturamento pela data de emissão. Vermelho: saldo a pagar pelo vencimento. Verde: saldo a receber pelo vencimento. A pagar e a receber consideram títulos em aberto ou parciais com previsão igual a zero.","source":"Fontes: /faturamento, /financeiro_pagar e /financeiro_receber. Valores em R$."},"chartClients":{"title":"Carteira por cliente","detail":"Os sete clientes com maior saldo total 'Vl. a faturar' na carteira. Considera somente OS aprovadas e itens com saldo a entregar maior que zero. Não se limita ao mês selecionado.","source":"Fonte: /CARTEIRA. Valores em R$."},"chartProduction":{"title":"Situação da produção","detail":"Distribuição das OS fora do limbo entre Em andamento, Não iniciadas, Finalizadas e Sem status, conforme o campo status_producao. Inclui finalizadas para exibir a composição completa.","source":"Fonte: /producao. Quantidade de OS, posição atual."},"s_pagas":{"title":"Contas pagas","detail":"Total liquidado (integral ou parcial) de títulos a pagar cujo VENCIMENTO pertence ao mês selecionado, excluindo previsões. O cálculo usa o valor do rateio menos seu saldo pendente; quando necessário, usa valor pago rateado ou rateio proporcional ao valor pago do título. É uma visão por vencimento, NÃO por data efetiva do pagamento.","source":"Fonte: /financeiro_pagar. Competência: mês do VENCIMENTO (não da baixa)."},"s_recebidas":{"title":"Contas recebidas","detail":"Total recebido (integral ou parcialmente) de títulos a receber cujo VENCIMENTO pertence ao mês selecionado, excluindo previsões. Usa o campo valor_recebido; quando indisponível, calcula valor corrigido menos saldo a receber. É uma visão por vencimento, NÃO por data efetiva do recebimento.","source":"Fonte: /financeiro_receber. Competência: mês do VENCIMENTO (não da baixa)."}};
var helpOpenTrigger=null;
function hideHelp(){
 var pop=byId('helpPopover');if(!pop)return;
 pop.hidden=true;
 if(helpOpenTrigger)helpOpenTrigger.setAttribute('aria-expanded','false');
 helpOpenTrigger=null;
}
function showHelp(trigger){
 var id=trigger.getAttribute('data-help'),def=HELP_DEFINITIONS[id];if(!def)return;
 var pop=byId('helpPopover');
 if(helpOpenTrigger===trigger&&!pop.hidden){hideHelp();return;}
 if(helpOpenTrigger)helpOpenTrigger.setAttribute('aria-expanded','false');
 helpOpenTrigger=trigger;trigger.setAttribute('aria-expanded','true');
 byId('helpTitle').textContent=def.title;
 byId('helpDescription').textContent=def.detail;
 byId('helpSource').textContent=def.source;
 pop.hidden=false;
 var rect=trigger.getBoundingClientRect(),width=Math.min(365,window.innerWidth-24);
 pop.style.width=width+'px';
 pop.style.left=Math.max(12,Math.min(rect.left-8,window.innerWidth-width-12))+'px';
 var below=rect.bottom+8;
 pop.style.top=(below+pop.offsetHeight+12<window.innerHeight?below:Math.max(12,rect.top-pop.offsetHeight-8))+'px';
}
document.addEventListener('click',function(e){
 var trigger=e.target.closest('.help-trigger');
 if(trigger){e.preventDefault();showHelp(trigger);return;}
 if(e.target.closest('#helpClose')){hideHelp();return;}
 if(!e.target.closest('#helpPopover'))hideHelp();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')hideHelp();});
window.addEventListener('resize',hideHelp);
window.addEventListener('scroll',hideHelp,true);

if(window.Chart && window.ChartDataLabels)window.Chart.register(window.ChartDataLabels);
function byId(id){return document.getElementById(id);}
function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function number(v){
 if(typeof v==='number')return Number.isFinite(v)?v:0;
 var s=text(v).replace(/R\$/g,'').replace(/\s/g,'').replace(/%/g,'');
 if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
 if(s.indexOf(',')>=0&&s.indexOf('.')>=0)s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(s.indexOf(',')>=0)s=s.replace(',','.');
 var n=Number(s);return Number.isFinite(n)?n:0;
}
function field(row,aliases){
 if(!row||typeof row!=='object')return undefined;
 for(var i=0;i<aliases.length;i++)if(row[aliases[i]]!==undefined&&row[aliases[i]]!==null)return row[aliases[i]];
 var map={};Object.keys(row).forEach(function(k){map[norm(k).replace(/[^A-Z0-9]/g,'')]=k;});
 for(var j=0;j<aliases.length;j++){var found=map[norm(aliases[j]).replace(/[^A-Z0-9]/g,'')];if(found!==undefined)return row[found];}
 return undefined;
}
function dateIso(v){
 if(v===undefined||v===null||v==='')return '';
 if(typeof v==='number'&&v>20000&&v<90000){var d0=new Date(1899,11,30);d0.setDate(d0.getDate()+Math.floor(v));return [d0.getFullYear(),String(d0.getMonth()+1).padStart(2,'0'),String(d0.getDate()).padStart(2,'0')].join('-');}
 var s=text(v);var m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
 m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
 if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
 var d=new Date(s);if(Number.isNaN(d.getTime()))return '';
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function monthOf(v){return dateIso(v).slice(0,7);}
function fmtBRL(v){return brl.format(v);}
function compact(v){
 if(v===null||v===undefined||!Number.isFinite(v))return '—';
 var n=Math.abs(v),sign=v<0?'-':'';
 if(n>=1000000)return sign+'R$ '+(n/1000000).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
 if(n>=10000)return sign+'R$ '+(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
 return fmtBRL(v);
}
function compactNumber(v){return v===null||v===undefined||!Number.isFinite(v)?'—':integer.format(v);}
function percent(v){return v===null||!Number.isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function available(k){return status[k].ready;}
function amount(r,keys){return number(field(r,keys));}
function setValue(id,v,kind){var el=byId(id);if(!el)return;el.textContent=kind==='money'?compact(v):kind==='percent'?percent(v):compactNumber(v);el.title=kind==='money'&&v!==null&&v!==undefined?fmtBRL(v):el.textContent;}
function sourceArray(json){
 if(Array.isArray(json))return json;
 var keys=['dados','data','registros','rows','items','results','resultado','faturamento'];
 for(var i=0;i<keys.length;i++){var v=json&&json[keys[i]];if(Array.isArray(v))return v;if(v&&typeof v==='object'&&Array.isArray(v.dados))return v.dados;}
 throw Error('A API não retornou uma lista de registros.');
}

function formatSyncDate(value,full) {
 if(!value)return 'sem horário registrado';
 var d=new Date(value);
 if(!Number.isFinite(d.getTime()))return 'horário desconhecido';
 return d.toLocaleString('pt-BR',full?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function sourceLabel(k,short) {
 var st=status[k];
 if(!st||!st.ready)return 'SEM DADOS'+(st?.error?' · atualização falhou':'');
 return (st.live?'API':'CACHE')+' · '+formatSyncDate(st.savedAt,!short)+(st.error?' · atualização falhou':'');
}
function syncStamp(iso){
 if(!iso)return 's/ horário';
 var d=new Date(iso);
 if(!Number.isFinite(d.getTime()))return 's/ horário';
 var now=new Date(),sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
 var time=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
 return sameDay?time:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+time;
}
function updateFreshness(){
 var cached=names.filter(function(k){return status[k].ready&&!status[k].live;});
 var failed=names.filter(function(k){return !status[k].ready&&!!status[k].error;});
 var pending=names.filter(function(k){return !status[k].ready&&!status[k].error;});
 var latestLive=names.filter(function(k){return status[k].live&&status[k].savedAt;})
   .map(function(k){return Date.parse(status[k].savedAt);}).filter(Number.isFinite);
 var oldestCache=cached.map(function(k){return Date.parse(status[k].savedAt);}).filter(Number.isFinite);
 var chip=byId('dataStatus'),label=byId('syncLabel'),description=byId('freshnessDescription'),details=byId('freshnessGrid');
 if(!chip||!label||!details)return;
 var time=latestLive.length?syncStamp(new Date(Math.max.apply(null,latestLive))):'';
 if(cached.length){
   label.textContent='Cache ('+cached.length+')'+(oldestCache.length?' · '+syncStamp(new Date(Math.min.apply(null,oldestCache))):'');
   chip.className='status-chip cache';
   description.textContent=cached.length+' de '+names.length+' fontes usando cache. Toque em cada fonte abaixo para conferir o horário. '+(failed.length?failed.length+' fonte(s) indisponível(is).':'');
 }else if(failed.length){
   label.textContent='Falha ('+failed.length+')';
   chip.className='status-chip bad';
   description.textContent=failed.length+' fonte(s) sem dados. As demais informações disponíveis continuam sendo exibidas.';
 }else if(pending.length){
   label.textContent=fetching?'Atualizando...':'Carregando...';
   chip.className='status-chip loading';
   description.textContent='Carregando os dados dos módulos.';
 }else{
   label.textContent='Atualizado'+(time?' · '+time:'');
   chip.className='status-chip ok';
   description.textContent='Fontes sincronizadas com as APIs. Horários detalhados abaixo.';
 }
 details.innerHTML=names.map(function(k){
   var st=status[k];
   var state=st.live?'API':st.ready?'CACHE':st.error?'ERRO':'CARREGANDO';
   var color=state==='CACHE'?' cache':state==='ERRO'?' bad':'';
   return '<div class="source-row"><strong>'+esc(SOURCES[k].name)+'</strong><span class="source-time'+color+'" title="'+esc(st.error||'')+'">'+esc(state)+' · '+esc(formatSyncDate(st.savedAt,true))+'</span></div>';
 }).join('');
 var summary=cached.length?cached.length+' fonte(s) em cache':failed.length?failed.length+' fonte(s) indisponível(is)':'Fontes atualizadas';
 chip.title=summary+'. Clique para ver data e hora por fonte.';
 chip.setAttribute('aria-label',summary+'. Abrir detalhes de atualização.');
}
function setStatus(){
 var ready=names.filter(function(k){return status[k].ready;}).length;
 var live=names.filter(function(k){return status[k].live;}).length;
 var failures=names.filter(function(k){return !!status[k].error;}).length;
 var stale=names.filter(function(k){return status[k].ready&&!status[k].live;}).length;
 var detail=byId('sourceDetail');
 if(detail)detail.textContent=live+'/'+names.length+' APIs online'+(stale?' · '+stale+' cache':'')+(failures?' · '+failures+' falha(s)':'');
 var dates=names.filter(function(k){return status[k].savedAt;}).map(function(k){return new Date(status[k].savedAt).getTime();}).filter(Number.isFinite);
 byId('lastUpdated').textContent=dates.length?'Última atualização registrada em '+new Date(Math.max.apply(null,dates)).toLocaleString('pt-BR'):'Sem dados recebidos';
 updateFreshness();
}
function closeFreshness(){
 var box=byId('freshnessPopover');if(!box)return;
 box.hidden=true;
 byId('dataStatus').setAttribute('aria-expanded','false');
}
function toggleFreshness(){
 var box=byId('freshnessPopover');if(!box)return;
 var open=box.hidden;
 box.hidden=!open;
 byId('dataStatus').setAttribute('aria-expanded',open?'true':'false');
}
byId('dataStatus').addEventListener('click',toggleFreshness);
byId('closeFreshness').addEventListener('click',closeFreshness);
document.addEventListener('click',function(e){
 if(!e.target.closest('.sync-wrap'))closeFreshness();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeFreshness();});
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,140);}
function loadCache(){
 if(!window.PstecCache)return Promise.resolve();
 return Promise.all(names.map(async function(k){
  try{var value=await window.PstecCache.read(SOURCES[k].cache);
   if(value&&Array.isArray(value.data)){data[k]=value.data;status[k].ready=true;status[k].live=false;status[k].savedAt=value.savedAt||null;}
  }catch(e){console.warn('Cache dashboard '+k,e);}
 })).then(function(){setStatus();render();});
}
async function getOne(k){
 var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},75000);
 try{
  var res=await fetch(ROOT+SOURCES[k].path+'?_t='+Date.now(),{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  var rows=sourceArray(await res.json()),saved=new Date().toISOString();
  data[k]=rows;status[k]={ready:true,live:true,savedAt:saved,error:null};
  if(window.PstecCache)window.PstecCache.write(SOURCES[k].cache,rows,saved).catch(function(e){console.warn('Cache '+k,e);});
 }catch(e){status[k].live=false;status[k].error=e.message||String(e);console.warn('Dashboard '+k,e);}
 finally{clearTimeout(timer);setStatus();scheduleRender();}
}
async function fetchAll(){
 if(fetching)return;
 fetching=true;lastStart=Date.now();byId('refreshBtn').disabled=true;setStatus();
 var cursor=0;
 async function worker(){while(cursor<names.length){var k=names[cursor++];await getOne(k);}}
 try{await Promise.all([worker(),worker(),worker(),worker()]);}
 finally{fetching=false;byId('refreshBtn').disabled=false;setStatus();render();}
}
function monthList(reference,count){
 var y=Number(reference.slice(0,4)),m=Number(reference.slice(5,7))-1,out=[];
 for(var i=count-1;i>=0;i--){var d=new Date(y,m-i,1);out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
 return out;
}
function fmtMonth(key){var parts=key.split('-'),m=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return (m[Number(parts[1])-1]||'?')+'/'+parts[0].slice(2);}
function revenueModel(){
 if(!available('faturamento'))return null;
 var rows=data.faturamento||[],mapped=[];
 var plans=[];
 rows.forEach(function(r){
  var date=field(r,['data_emissao','dt_emissao','data_emissao_nf','dt_emissao_nf','emissao','data_faturamento','dt_faturamento','data_nf','dt_nf','data_nota','data','data_fat']);
  var raw=field(r,['valor_total','vl_total','valor_faturamento','vl_faturamento','vl_faturado','faturamento','valor','valor_nf','vl_total_item','total_nf','valorliquido','valor_liquido','valor_total_nota','vl_total_nota','vl_total_produto']);
  var plan=field(r,['plano_de_contas','plano_de_conta','plano_contas','plano_conta','conta_contabil','nome_plano_contas','descricao_plano_contas','plano','tipo_faturamento','conta','nome_plano','nome_conta','descricao_conta']);
  var mk=monthOf(date);
  if(mk&&raw!==undefined&&raw!==null&&raw!==''){mapped.push({month:mk,value:number(raw),plan:norm(plan)});plans.push(norm(plan));}
 });
 if(rows.length&&mapped.length===0)return null;
 var sales=['VENDA DE PRODUTOS','VENDA DE SERVICOS','VENDA DE SUCATA'];
 var hasSales=plans.some(function(p){return sales.indexOf(p)>=0;});
 return mapped.filter(function(r){return !hasSales||sales.indexOf(r.plan)>=0;});
}
function carteiraModel(){
 if(!available('carteira'))return null;
 return data.carteira.filter(function(r){
  return norm(field(r,['Status OS','status_os']))==='APROVADO'&&amount(r,['Saldo a entregar','saldo_a_entregar'])>0;
 });
}
function productionModel(){
 if(!available('producao'))return null;
 var rows=data.producao.filter(function(r){return String(r.u_limbo)!=='1';});
 var active=rows.filter(function(r){var s=norm(r.status_producao);return s.indexOf('FINALIZADO')<0&&s.indexOf('100%')<0&&s.indexOf('CONCLUID')<0;});
 var late=active.filter(function(r){return ['SIM','S','1','TRUE'].indexOf(norm(r.atrasada))>=0;});
 return {rows:rows,active:active,late:late};
}
function capitalModel(){
 if(!available('capital'))return null;
 var rows=data.capital.filter(function(r){return norm(r['Status OS']||r.status_os)==='APROVADO'&&amount(r,['Saldo a entregar'])>0;});
 return rows.reduce(function(sum,r){
  var silver=amount(r,['Cotação Prata Atual'])*amount(r,['Qtde. AG por pedido']);
  return sum+silver*1.15+amount(r,['Vl. MP comum'])+amount(r,['Impostos a pagar']);
 },0);
}
function financialRows(type,ref){
 if(!available(type))return null;
 return data[type].filter(function(r){
  if(monthOf(r.dt_vencimento)!==ref)return false;
  var prev=r.previsao;
  if(prev!==undefined&&prev!==null&&prev!==''&&number(prev)!==0)return false;
  var stat=norm(type==='pagar'?r.status_pagamento:r.status_titulo);
  return !stat||stat==='EM ABERTO'||stat==='PARCIAL';
 });
}
function payModel(ref){
 var rows=financialRows('pagar',ref);
 return rows===null?null:rows.reduce(function(sum,r){return sum+amount(r,['saldo_rateado','valor_rateio','saldo','valor']);},0);
}
function receiveModel(ref){
 var rows=financialRows('receber',ref);
 return rows===null?null:rows.reduce(function(sum,r){return sum+amount(r,['saldo_a_receber','saldo','valor']);},0);
}

/* Total já liquidado, pela competência do vencimento, conforme o financeiro existente. */
function paidModel(ref){
 if(!available('pagar'))return null;
 var sum=0,identified=false,eligible=0;
 data.pagar.forEach(function(r){
  if(monthOf(r.dt_vencimento)!==ref||number(r.previsao)!==0)return;
  var stat=norm(r.status_pagamento);
  if(!['PAGO','PAGA','PARCIAL','LIQUIDADO'].includes(stat))return;
  eligible++;
  var rateio=field(r,['valor_rateio']),saldo=field(r,['saldo_rateado']);
  var paid=field(r,['valor_pago_rateado','vl_pago_rateado','valor_pago_rateio']);
  if(paid!==undefined&&paid!==null&&paid!==''){sum+=Math.max(0,number(paid));identified=true;return;}
  if(rateio!==undefined&&rateio!==null&&rateio!==''&&saldo!==undefined&&saldo!==null&&saldo!==''){
    sum+=Math.max(0,number(rateio)-number(saldo));identified=true;return;
  }
  var titleValue=field(r,['valor_titulo','valor_corrigido_titulo']),paidTitle=field(r,['valor_pago_titulo']);
  if(rateio!==undefined&&rateio!==null&&rateio!==''&&titleValue!==undefined&&number(titleValue)>0&&paidTitle!==undefined&&paidTitle!==null){
    sum+=Math.max(0,number(rateio)*Math.min(1,number(paidTitle)/number(titleValue)));identified=true;return;
  }
  if(stat==='PAGO'||stat==='PAGA'||stat==='LIQUIDADO'){
   if(rateio!==undefined&&rateio!==null&&rateio!==''){sum+=Math.max(0,number(rateio));identified=true;}
  }
 });
 return eligible&&!identified?null:sum;
}
function receivedModel(ref){
 if(!available('receber'))return null;
 var sum=0,eligible=0,identified=false;
 data.receber.forEach(function(r){
  if(monthOf(r.dt_vencimento)!==ref||number(r.previsao)!==0)return;
  var stat=norm(r.status_titulo);
  if(!['RECEBIDO','RECEBIDA','PARCIAL','LIQUIDADO'].includes(stat))return;
  eligible++;
  var received=field(r,['valor_recebido','vl_recebido','valor_ja_recebido']);
  if(received!==undefined&&received!==null&&received!==''){sum+=Math.max(0,number(received));identified=true;return;}
  var total=field(r,['valor_corrigido_titulo','valor_titulo']),saldo=field(r,['saldo_a_receber']);
  if(total!==undefined&&total!==null&&total!==''&&saldo!==undefined&&saldo!==null&&saldo!==''){
   sum+=Math.max(0,number(total)-number(saldo));identified=true;return;
  }
  if(['RECEBIDO','RECEBIDA','LIQUIDADO'].includes(stat)&&total!==undefined&&total!==null&&total!==''){
   sum+=Math.max(0,number(total));identified=true;
  }
 });
 return eligible&&!identified?null:sum;
}

function purchaseModel(){
 if(!available('materiais')||!available('ocs'))return null;
 var valid=data.materiais.filter(function(m){
  return number(m.destino)!==3 && (m.cod_familia==null||number(m.cod_familia)!==22) && (m.inativo==null||number(m.inativo)===0)
   && !(number(m.processado)===1&&number(m.qtde_solicitada)<=0);
 });
 var key=function(r){return [r.cod_empresa,r.cod_os,r.cod_os_aux==null?'':r.cod_os_aux,r.guid_lm==null?'':r.guid_lm].join('|');};
 var ocs=new Set(data.ocs.map(key));
 var mats=new Map();
 valid.forEach(function(r){if(!mats.has(key(r)))mats.set(key(r),r);});
 var rows=Array.from(mats.values());
 return {
  notProcessed:rows.filter(function(r){return number(r.processado)!==1;}).length,
  withoutOC:rows.filter(function(r){return number(r.processado)===1&&number(r.qtde_solicitada)>0&&!ocs.has(key(r));}).length
 };
}
function qualityModel(ref){
 if(!available('indicadores'))return null;
 var rows=data.indicadores.filter(function(r){return monthOf(field(r,['Emissão','Emissao','emissao','dt_emissao']))===ref;});
 var eligible=0,inside=0,late=0;
 rows.forEach(function(r){
  var st=norm(field(r,['Status Prazo','status_prazo']));
  var q=amount(r,['Qtde NF','qtde_nf','Qtde','qtde']);
  if(st==='DENTRO DO PRAZO'||st==='PARCIAL NO PRAZO'){eligible+=q;inside+=q;}
  else if(st==='FORA DO PRAZO'||st==='PARCIAL EM ATRASO'){eligible+=q;late+=q;}
 });
 return {rate:eligible?100*inside/eligible:null,qty:eligible,late:late};
}
function productionState(r){
 var st=norm(r.status_producao);
 if(st.indexOf('FINALIZADO')>=0||st.indexOf('100%')>=0||st.indexOf('CONCLUID')>=0)return 'Finalizadas';
 if(st.indexOf('NAO INICI')>=0||st.indexOf('SEM APONT')>=0||st.indexOf('0%')>=0)return 'Não iniciadas';
 if(st==='')return 'Sem status';
 return 'Em andamento';
}
function upsertChart(id,config,emptyId,hasRows){
 var empty=byId(emptyId);
 if(charts[id]){charts[id].destroy();delete charts[id];}
 if(!window.Chart||!hasRows){if(empty)empty.hidden=false;return;}
 if(empty)empty.hidden=true;
 charts[id]=new Chart(byId(id),config);
}
function chartMoney(v) {
 var n=Number(v)||0,abs=Math.abs(n),sign=n<0?'-':'';
 if(abs>=1000000)return sign+'R$ '+(abs/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi';
 if(abs>=1000)return sign+'R$ '+(abs/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
 return sign+'R$ '+Math.round(abs).toLocaleString('pt-BR');
}
function chartCommon(money){
 return {responsive:true,maintainAspectRatio:false,animation:{duration:150},
  layout:{padding:{top:24,right:28,bottom:12,left:8}},
  plugins:{
   legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,font:{size:11}}},
   datalabels:{
     display:true,anchor:'end',align:'top',offset:3,clamp:true,clip:false,
     formatter:function(v){return money?chartMoney(v):integer.format(v);},
     color:'#253f63',font:{size:9,weight:'700'}
   },
   tooltip:{callbacks:{label:function(ctx){return (ctx.dataset.label||ctx.label||'Valor')+': '+(money?fmtBRL(ctx.raw||0):integer.format(ctx.raw||0));}}}
  },
  scales:{x:{grid:{display:false},ticks:{font:{size:10},color:'#667b95'}},y:{beginAtZero:true,grid:{color:'#eff2f7'},ticks:{font:{size:10},callback:function(v){return new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(v);}}}}
 };
}
function renderCharts(ref,fat,carteira,production){
 var months=monthList(ref,6);
 var revenue=new Map(),pay=new Map(),receiv=new Map();
 if(fat)fat.forEach(function(r){revenue.set(r.month,(revenue.get(r.month)||0)+r.value);});
 if(available('pagar')&&available('receber')){
  months.forEach(function(m){pay.set(m,payModel(m));receiv.set(m,receiveModel(m));});
 }
 var finReady=fat!==null||available('pagar')||available('receber');
 var monthlyDatasets=[];
 if(fat!==null)monthlyDatasets.push({label:'Faturamento realizado',data:months.map(function(m){return revenue.get(m)||0;}),borderColor:'#0047cc',backgroundColor:'#0047cc',borderWidth:2.5,tension:.25,fill:false});
 if(available('pagar'))monthlyDatasets.push({label:'A pagar',data:months.map(function(m){return payModel(m);}),borderColor:'#d66367',backgroundColor:'#d66367',borderWidth:2,tension:.25,fill:false});
 if(available('receber'))monthlyDatasets.push({label:'A receber',data:months.map(function(m){return receiveModel(m);}),borderColor:'#0c9a72',backgroundColor:'#0c9a72',borderWidth:2,tension:.25,fill:false});
 var configM={type:'line',data:{labels:months.map(fmtMonth),datasets:monthlyDatasets},options:chartCommon(true)};
 configM.options.plugins.tooltip.callbacks.label=function(ctx){return ctx.dataset.label+': '+fmtBRL(ctx.parsed.y||0);};
 configM.options.plugins.datalabels.align=function(ctx){return ['top','bottom','right'][ctx.datasetIndex]||'top';};
 configM.options.plugins.datalabels.offset=function(ctx){return ctx.datasetIndex===2?5:3;};
 configM.options.elements={point:{radius:3,hoverRadius:5}};
 upsertChart('chartMonthly',configM,'emptyMonthly',finReady&&monthlyDatasets.length>0);
 var grouped=new Map();
 if(carteira)carteira.forEach(function(r){var c=text(field(r,['Cliente','cliente']))||'Sem cliente',v=amount(r,['Vl. a faturar']);grouped.set(c,(grouped.get(c)||0)+v);});
 var top=Array.from(grouped.entries()).sort(function(a,b){return b[1]-a[1];}).slice(0,7);
 var labels=top.map(function(r){return r[0].length>24?r[0].slice(0,22)+'…':r[0];});
 var confC={type:'bar',data:{labels:labels,datasets:[{label:'A faturar',data:top.map(function(r){return r[1];}),backgroundColor:'#2471ce',borderRadius:5,barThickness:18}]},options:chartCommon(true)};
 confC.options.indexAxis='y';
 confC.options.plugins.legend.display=false;
 confC.options.layout={padding:{top:8,right:92,bottom:5,left:0}};
 confC.options.plugins.datalabels={display:true,anchor:'end',align:'right',offset:5,clamp:true,clip:false,formatter:chartMoney,color:'#1c416e',font:{size:10,weight:'800'}};
 confC.options.plugins.tooltip.callbacks.label=function(ctx){return fmtBRL(ctx.parsed.x||0);};
 confC.options.scales.x.ticks.callback=function(v){return new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(v);};
 confC.options.scales.y.ticks={font:{size:10},autoSkip:false};
 upsertChart('chartClients',confC,'emptyClients',top.length>0);
 var counts=new Map();
 if(production)production.rows.forEach(function(r){var k=productionState(r);counts.set(k,(counts.get(k)||0)+1);});
 var groups=Array.from(counts.entries());
 var colors={'Em andamento':'#0047cc','Finalizadas':'#18a47b','Não iniciadas':'#e5a332','Sem status':'#a7b5c5'};
 var confP={type:'doughnut',data:{labels:groups.map(function(r){return r[0]+' ('+r[1]+')';}),datasets:[{label:'OS',data:groups.map(function(r){return r[1];}),backgroundColor:groups.map(function(r){return colors[r[0]]||'#9db1c8';}),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'67%',plugins:{legend:{position:'right',labels:{boxWidth:12,font:{size:11},padding:10}},datalabels:{display:true,formatter:function(v){return integer.format(v);},color:'#fff',font:{size:12,weight:'bold'},anchor:'center',align:'center',clamp:true},tooltip:{callbacks:{label:function(ctx){return ctx.label+': '+ctx.raw+' OS';}}}}}};
 upsertChart('chartProduction',confP,'emptyProduction',groups.length>0);
}
function renderAlerts(production,carteira,purchase,quality,net){
 var alerts=[];
 if(production&&production.late.length){
  var examples=production.late.slice(0,3).map(function(r){return text(r.n_os||r.cod_os_completo||r.os);}).filter(Boolean).join(', ');
  alerts.push({level:'red',title:integer.format(production.late.length)+' OS atrasadas',body:'Produção com prazo em atraso'+(examples?'. Exemplos: '+examples:'')+'.',url:'producao.html',link:'Ver produção'});
 }
 if(carteira){
  var todayIso=dateIso(new Date()),late=carteira.filter(function(r){var d=dateIso(field(r,['Dt. Pesquisa','Dt. Negociada','Prev. entrega(original)']));return d&&d<todayIso;});
  if(late.length)alerts.push({level:'red',title:integer.format(late.length)+' itens da carteira com prazo vencido',body:'Saldo a faturar em atraso: '+fmtBRL(late.reduce(function(s,r){return s+amount(r,['Vl. a faturar']);},0))+'.',url:'carteira.html',link:'Ver carteira'});
 }
 if(purchase&&purchase.withoutOC)alerts.push({level:'gold',title:integer.format(purchase.withoutOC)+' materiais ainda sem OC',body:'Materiais processados e solicitados, mas sem ordem de compra vinculada.',url:'compras.html',link:'Ver compras'});
 if(purchase&&purchase.notProcessed)alerts.push({level:'gold',title:integer.format(purchase.notProcessed)+' materiais não processados',body:'Itens da lista de materiais aguardando processamento.',url:'compras.html',link:'Ver materiais'});
 if(quality&&quality.late>0)alerts.push({level:'gold',title:integer.format(quality.late)+' unidades faturadas fora do prazo',body:'Quantidade faturada com atraso no mês selecionado.',url:'indicadores-faturamento.html',link:'Ver indicadores'});
 if(net!==null&&net<0)alerts.push({level:'red',title:'Saldo financeiro negativo no mês',body:'Diferença projetada entre contas a receber e a pagar: '+fmtBRL(net)+'.',url:'financeiro.html',link:'Ver financeiro'});
 var failed=names.filter(function(k){return status[k].error&&!status[k].ready;});
 if(failed.length)alerts.push({level:'gold',title:'Fontes temporariamente indisponíveis',body:failed.map(function(k){return SOURCES[k].name;}).join(', ')+'. Indicadores dessas fontes aparecem com travessão.',url:'',link:''});
 if(!alerts.length)alerts.push({level:'',title:'Nenhuma atenção identificada pelos dados disponíveis',body:'Continue acompanhando os indicadores e o status de atualização das fontes.',url:'',link:''});
 byId('alertCount').textContent=alerts.length+' aviso(s)';
 byId('alerts').innerHTML=alerts.slice(0,8).map(function(a){
  return '<div class="alert '+a.level+'"><span class="dot"></span><div><strong>'+esc(a.title)+'</strong><p>'+esc(a.body)+(a.url?' <a href="'+a.url+'">'+esc(a.link)+' →</a>':'')+'</p></div></div>';
 }).join('');
}
function render(){
 var ref=monthEl.value||defaultMonth,fat=revenueModel(),carteira=carteiraModel(),production=productionModel();
 var capital=capitalModel(),purchase=purchaseModel(),quality=qualityModel(ref);
 var pagar=payModel(ref),receber=receiveModel(ref),pagas=paidModel(ref),recebidas=receivedModel(ref),net=pagar===null||receber===null?null:receber-pagar;
 var fatMonth=fat===null?null:fat.reduce(function(s,r){return s+(r.month===ref?r.value:0);},0);
 var carteiraVal=carteira===null?null:carteira.reduce(function(s,r){return s+amount(r,['Vl. a faturar']);},0);
 setValue('k_fat',fatMonth,'money');setValue('k_carteira',carteiraVal,'money');
 setValue('k_capital',capital,'money');setValue('k_saldo',net,'money');
 setValue('k_os',production?production.active.length:null);
 setValue('k_atrasadas',production?production.late.length:null);
 setValue('k_compras',purchase?purchase.withoutOC:null);
 setValue('k_pontualidade',quality?quality.rate:null,'percent');
 setValue('s_pagar',pagar,'money');setValue('s_pagas',pagas,'money');setValue('s_receber',receber,'money');setValue('s_recebidas',recebidas,'money');
 setValue('s_naoprocessado',purchase?purchase.notProcessed:null);
 renderCharts(ref,fat,carteira,production);
 renderAlerts(production,carteira,purchase,quality,net);
}
monthEl.addEventListener('change',function(){if(!monthEl.value)monthEl.value=defaultMonth;localStorage.setItem('pstec_dashboard_mes',monthEl.value);render();});
byId('refreshBtn').addEventListener('click',fetchAll);
byId('logout').addEventListener('click',function(){['pstec_token','pstec_usuario_nome','pstec_perm_faturamento','pstec_perm_finalizacao'].forEach(function(k){localStorage.removeItem(k);});location.href='login-pstec.html';});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&Date.now()-lastStart>5*60*1000)fetchAll();});
setInterval(function(){if(!document.hidden&&Date.now()-lastStart>=5*60*1000)fetchAll();},60*1000);
if(window.lucide)lucide.createIcons();
setStatus();loadCache().finally(fetchAll);
})();