-- PSTEC | OC por material com vinculo rastreavel a cotacao
-- Novo: guid_item_cotacao_referenciado e cod_cotacao_referenciada
-- Mantem todos os campos anteriores para o front.
SELECT
    v.cod_empresa,
    v.cod_os,
    v.cod_os_aux,
    v.guid_lm,
    v.guid_pai AS guid_item_oc,
    v.guid_solicitacao,
    v.cod_solicitacao AS cod_solicitacao_vinculo,
    v.guid_cotacao AS guid_item_cotacao_referenciado,
    v.cod_cotacao AS cod_cotacao_referenciada,
    it.cod_ord_compra AS cod_oc,
    it.qtde AS qtde_oc,
    it.qtde_entregue AS qtde_entregue_oc_cps,
    it.total AS valor_item_oc,
    oc.data::date AS dt_oc,
    oc.dt_prevista_entrega::date AS dt_prevista_oc,
    oc.cod_fornecedor,
    oc.fornecedor,
    oc.totalgeral AS valor_total_oc,
    h.dt_solicitacao::date AS dt_solicitacao_oc
FROM public.tos o
JOIN public.tord_aux_os v
  ON v.cod_empresa = o.cod_empresa
 AND v.cod_os = o.codigo
JOIN public.tord_aux it
  ON it.cod_empresa = v.cod_empresa
 AND it.guid_linha = v.guid_pai
JOIN public.tord_com oc
  ON oc.cod_empresa = it.cod_empresa
 AND oc.codigo = it.cod_ord_compra
LEFT JOIN public.tsol_max sm
  ON sm.cod_empresa = v.cod_empresa
 AND sm.guid_linha = v.guid_solicitacao
LEFT JOIN public.tsol_mat h
  ON h.cod_empresa = v.cod_empresa
 AND h.codigo = COALESCE(sm.cod_solicitacao, v.cod_solicitacao)
 AND COALESCE(h.cancelado,0) = 0
WHERE o.concluido = 0
  AND o.aprovado = 1
  AND o.cancelado = 0
  AND o.n_os NOT LIKE 'E%'
  AND COALESCE(v.cancelado,0) = 0
  AND COALESCE(oc.cancelado,0) = 0;