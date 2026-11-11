-- PSTEC | 07 - COMPRAS DE SERVICOS TERCEIRIZADOS
-- Fonte: TSERV_TE (servicos previstos), TORD_SERV (itens de OC),
-- TORD_COM (cabecalho da OC), TCOM_SERV/TCOMPRAS (entradas),
-- TSOL_AUX_SERV/TSOL_MAT (solicitacoes), TCOT_SER/TCOTACAO (cotacoes)
-- e TPAGAR (titulos da OC). Somente SELECT.
-- Mantem servicos sem OC e OCs de servicos sem registro em TSERV_TE.
-- Nao multiplica recebimentos e titulos ao agregar por item/OC.
WITH os_ativas AS (
    SELECT os.cod_empresa, os.codigo AS cod_os, os.n_os,
           os.titulo AS titulo_os, os.cliente, os.cod_cliente,
           os.dt_entrada::date AS dt_entrada_os,
           os.dt_prevista::date AS dt_prevista_os,
           os.u_dt_renegociacao::date AS dt_renegociacao_os
    FROM public.tos os
    WHERE os.concluido = 0
      AND os.aprovado = 1
      AND os.cancelado = 0
      AND os.n_os NOT LIKE 'E%'
),
oc_servico AS (
    SELECT it.cod_empresa, it.cod_os, it.cod_os_aux,
           it.cod_ser_aut, it.aut_ AS aut_item_oc,
           it.cod_solicitacao, it.cod_cotacao,
           it.cod_ordem_compra AS cod_oc,
           it.qtde AS qtde_oc,
           it.qtde_entregue AS qtde_entregue_oc_cps,
           it.vl_total AS valor_item_oc,
           it.dt_prevista_entrega::date AS dt_prevista_item_oc,
           it.titulo_servico, it.descricao_os,
           it.grupo_serv_ter, it.sub_grupo_serv_ter,
           oc.data::date AS dt_oc,
           oc.dt_prevista_entrega::date AS dt_prevista_oc,
           oc.cod_fornecedor, oc.fornecedor,
           oc.totalgeral AS valor_total_oc
    FROM public.tord_serv it
    JOIN public.tord_com oc
      ON oc.cod_empresa = it.cod_empresa
     AND oc.codigo = it.cod_ordem_compra
    JOIN os_ativas os
      ON os.cod_empresa = it.cod_empresa
     AND os.cod_os = it.cod_os
    WHERE COALESCE(it.cancelado,0) = 0
      AND COALESCE(oc.cancelado,0) = 0
),
solicitacoes AS (
    SELECT s.cod_empresa, s.cod_os, s.cod_os_aux, s.cod_ser_aut,
           MIN(h.dt_solicitacao::date) AS dt_solicitacao
    FROM public.tsol_aux_serv s
    JOIN public.tsol_mat h
      ON h.cod_empresa = s.cod_empresa
     AND h.codigo = s.cod_solicitacao
    WHERE COALESCE(s.cancelado,0) = 0
      AND COALESCE(h.cancelado,0) = 0
    GROUP BY s.cod_empresa,s.cod_os,s.cod_os_aux,s.cod_ser_aut
),
cotacoes AS (
    SELECT c.cod_empresa, c.cod_os, c.cod_os_aux, c.cod_ser_aut,
           MIN(h.data::date) AS dt_primeira_cotacao,
           STRING_AGG(DISTINCT h.codigo::text, ', ') AS cotacoes,
           COUNT(DISTINCT h.codigo)::integer AS qtd_cotacoes
    FROM public.tcot_ser c
    JOIN public.tcotacao h
      ON h.cod_empresa = c.cod_empresa
     AND h.codigo = c.cod_cotacao
    WHERE COALESCE(c.cancelado,0) = 0
    GROUP BY c.cod_empresa,c.cod_os,c.cod_os_aux,c.cod_ser_aut
),
entradas AS (
    SELECT e.cod_empresa, e.cod_ordem_compra AS cod_oc,
           e.cod_ord_serv_aut AS aut_item_oc,
           SUM(COALESCE(e.qtde,0)) AS qtde_recebida,
           MIN(n.dt_recebimento::date) AS dt_primeira_entrada,
           MAX(n.dt_recebimento::date) AS dt_ultima_entrada,
           COUNT(DISTINCT n.codigo)::integer AS qtd_notas_entrada,
           STRING_AGG(DISTINCT NULLIF(n.n_nf::text,''), ', ') AS nfs_entrada
    FROM public.tcom_serv e
    JOIN public.tcompras n
      ON n.cod_empresa = e.cod_empresa
     AND n.codigo = e.cod_compra
    WHERE COALESCE(e.cancelado,0) = 0
    GROUP BY e.cod_empresa,e.cod_ordem_compra,e.cod_ord_serv_aut
),
titulos AS (
    SELECT p.cod_empresa, p.cod_fornecedor, p.cod_ordem_compra AS cod_oc,
           COUNT(*)::integer AS qtd_titulos_oc,
           SUM(COALESCE(p.valor,0)) AS valor_titulos_oc,
           SUM(COALESCE(p.valor_pago,0)) AS valor_pago_oc,
           SUM(GREATEST(0,COALESCE(p.valor,0)-COALESCE(p.valor_pago,0))) AS saldo_pagar_oc,
           MAX(p.dt_pagamento::date) AS ultimo_pagamento
    FROM public.tpagar p
    WHERE p.cod_ordem_compra IS NOT NULL
    GROUP BY p.cod_empresa,p.cod_fornecedor,p.cod_ordem_compra
),
contagem_oc AS (
    SELECT cod_empresa,cod_os,COALESCE(cod_os_aux,0) AS cod_os_aux,
           cod_ser_aut,COUNT(*)::integer AS qtd_itens_oc
    FROM oc_servico
    GROUP BY cod_empresa,cod_os,COALESCE(cod_os_aux,0),cod_ser_aut
)
SELECT 'SERVICO'::text AS tipo_item,
       os.cod_empresa,os.cod_os,os.n_os,os.titulo_os,
       os.cliente,os.cod_cliente,os.dt_entrada_os,os.dt_prevista_os,
       os.dt_renegociacao_os,
       COALESCE(s.cod_os_aux,oc.cod_os_aux,0) AS cod_os_aux,
       aux.subtitulo AS titulo_subos,
       COALESCE(s.aut_,oc.cod_ser_aut, -oc.aut_item_oc) AS aut_servico,
       COALESCE(NULLIF(oc.titulo_servico,''),
                NULLIF(s.operacao_executada,''),
                NULLIF(s.sub_grupo_serv_ter,''),
                NULLIF(s.grupo_serv_ter,''),
                NULLIF(s.descricao_os,''),'Servico terceirizado') AS produto,
       s.n_servico AS cod_interno,
       s.cod_produto,
       s.unidade,
       COALESCE(s.qtde,oc.qtde_oc,0) AS qtde_lista,
       s.solicitado,
       s.servicoaprovado,
       s.dt_necessidade::date AS dt_necessidade,
       s.dt_prevista_entrega::date AS dt_prevista_servico,
       s.dt_recebimento::date AS dt_recebimento_servico_cps,
       s.qtde_recebida AS qtde_recebida_servico_cps,
       sol.dt_solicitacao,
       cot.dt_primeira_cotacao,cot.cotacoes,cot.qtd_cotacoes,
       CASE WHEN oc.cod_cotacao IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.tcot_ser cit
             WHERE cit.cod_empresa = oc.cod_empresa
               AND cit.cod_cotacao = oc.cod_cotacao
               AND cit.cod_os = oc.cod_os
               AND COALESCE(cit.cod_os_aux,0) = COALESCE(oc.cod_os_aux,0)
               AND cit.cod_ser_aut = oc.cod_ser_aut
               AND COALESCE(cit.cancelado,0) = 0
            ) THEN cot_oc.data::date ELSE NULL END AS dt_cotacao_vinculada_oc,
       oc.cod_cotacao AS cod_cotacao_referenciada,
       oc.cod_solicitacao AS cod_solicitacao_referenciada,
       oc.aut_item_oc,
       oc.cod_oc,oc.qtde_oc,oc.qtde_entregue_oc_cps,
       oc.valor_item_oc,oc.dt_oc,
       COALESCE(oc.dt_prevista_item_oc,oc.dt_prevista_oc) AS dt_prevista_oc,
       oc.cod_fornecedor,oc.fornecedor,oc.valor_total_oc,
       CASE WHEN ent.qtde_recebida IS NOT NULL THEN ent.qtde_recebida
            WHEN oc.cod_oc IS NOT NULL AND conta.qtd_itens_oc = 1
              THEN COALESCE(s.qtde_recebida,0)
            ELSE 0 END AS qtde_recebida,
       COALESCE(ent.dt_primeira_entrada,
                CASE WHEN oc.cod_oc IS NOT NULL AND conta.qtd_itens_oc = 1
                     THEN s.dt_recebimento::date ELSE NULL END) AS dt_primeira_entrada,
       COALESCE(ent.dt_ultima_entrada,
                CASE WHEN oc.cod_oc IS NOT NULL AND conta.qtd_itens_oc = 1
                     THEN s.dt_recebimento::date ELSE NULL END) AS dt_ultima_entrada,
       COALESCE(ent.qtd_notas_entrada,0) AS qtd_notas_entrada,
       COALESCE(ent.nfs_entrada,'') AS nfs_entrada,
       COALESCE(fin.qtd_titulos_oc,0) AS qtd_titulos_oc,
       COALESCE(fin.valor_titulos_oc,0) AS valor_titulos_oc,
       COALESCE(fin.valor_pago_oc,0) AS valor_pago_oc,
       COALESCE(fin.saldo_pagar_oc,0) AS saldo_pagar_oc,
       fin.ultimo_pagamento
FROM public.tserv_te s
FULL OUTER JOIN oc_servico oc
  ON oc.cod_empresa = s.cod_empresa
 AND oc.cod_os = s.cod_os
 AND COALESCE(oc.cod_os_aux,0) = COALESCE(s.cod_os_aux,0)
 AND oc.cod_ser_aut = s.aut_
JOIN os_ativas os
  ON os.cod_empresa = COALESCE(s.cod_empresa,oc.cod_empresa)
 AND os.cod_os = COALESCE(s.cod_os,oc.cod_os)
LEFT JOIN public.tos_aux aux
  ON aux.cod_empresa = os.cod_empresa
 AND aux.cod_os = os.cod_os
 AND aux.codigo = COALESCE(s.cod_os_aux,oc.cod_os_aux)
LEFT JOIN solicitacoes sol
  ON sol.cod_empresa = os.cod_empresa
 AND sol.cod_os = os.cod_os
 AND COALESCE(sol.cod_os_aux,0) = COALESCE(s.cod_os_aux,oc.cod_os_aux,0)
 AND sol.cod_ser_aut = COALESCE(s.aut_,oc.cod_ser_aut)
LEFT JOIN cotacoes cot
  ON cot.cod_empresa = os.cod_empresa
 AND cot.cod_os = os.cod_os
 AND COALESCE(cot.cod_os_aux,0) = COALESCE(s.cod_os_aux,oc.cod_os_aux,0)
 AND cot.cod_ser_aut = COALESCE(s.aut_,oc.cod_ser_aut)
LEFT JOIN public.tcotacao cot_oc
  ON cot_oc.cod_empresa = oc.cod_empresa
 AND cot_oc.codigo = oc.cod_cotacao
LEFT JOIN entradas ent
  ON ent.cod_empresa = oc.cod_empresa
 AND ent.cod_oc = oc.cod_oc
 AND ent.aut_item_oc = oc.aut_item_oc
LEFT JOIN titulos fin
  ON fin.cod_empresa = oc.cod_empresa
 AND fin.cod_oc = oc.cod_oc
 AND fin.cod_fornecedor = oc.cod_fornecedor
LEFT JOIN contagem_oc conta
  ON conta.cod_empresa = os.cod_empresa
 AND conta.cod_os = os.cod_os
 AND conta.cod_os_aux = COALESCE(s.cod_os_aux,oc.cod_os_aux,0)
 AND conta.cod_ser_aut = COALESCE(s.aut_,oc.cod_ser_aut)
ORDER BY os.cod_empresa,os.n_os,COALESCE(s.cod_os_aux,oc.cod_os_aux,0),
         COALESCE(s.aut_,oc.cod_ser_aut, -oc.aut_item_oc),oc.cod_oc;