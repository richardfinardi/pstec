-- PSTEC - 06 COTACOES VINCULADAS AOS MATERIAIS DA OS
-- Execute na API como endpoint automatico /06_compras_cotacoes.
-- Uma linha por vinculo item de cotacao/OS (o painel elimina repeticoes).
SELECT
    v.cod_empresa,
    v.cod_os,
    v.cod_os_aux,
    v.guid_lm,
    v.guid_pai AS guid_item_cotacao,
    c.codigo AS cod_cotacao,
    c.data::date AS dt_cotacao,
    c.status AS status_cotacao,
    i.qtde AS qtde_cotada
FROM public.tos o
JOIN public.tcot_aux_os v
  ON v.cod_empresa = o.cod_empresa
 AND v.cod_os = o.codigo
JOIN public.tcot_aux i
  ON i.cod_empresa = v.cod_empresa
 AND i.guid_linha = v.guid_pai
JOIN public.tcotacao c
  ON c.cod_empresa = i.cod_empresa
 AND c.codigo = i.cod_cotacao
WHERE o.concluido = 0
  AND o.aprovado = 1
  AND o.cancelado = 0
  AND o.n_os NOT LIKE 'E%'
  AND COALESCE(v.cancelado,0) = 0;
