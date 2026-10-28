-- PSTEC | 01 - MATERIAIS PARA MONITORAMENTO DE COMPRAS
-- Substituir este arquivo na pasta /sql da API PSTEC.
-- Nao processados entram; processados sem solicitacao nao entram.
SELECT os.cod_empresa,
       os.codigo AS cod_os,
       os.n_os,
       os.titulo AS titulo_os,
       os.cliente,
       os.cod_cliente,
       os.dt_entrada::date AS dt_entrada_os,
       os.dt_prevista::date AS dt_prevista_os,
       os.u_dt_renegociacao::date AS dt_renegociacao_os,
       lm.cod_os_aux,
       aux.subtitulo AS titulo_subos,
       lm.guid_linha AS guid_lm,
       lm.cod_produto,
       lm.cod_interno,
       lm.produto,
       lm.unidade,
       lm.qtde AS qtde_lista,
       lm.qtde_solicitada,
       lm.qtde_compra AS qtde_a_comprar_cps,
       lm.qtde_entregue AS qtde_entregue_cps,
       lm.qtde_reservada,
       lm.qtde_utilizada,
       lm.destino,
       lm.processado,
       lm.dt_necessidade::date AS dt_necessidade
FROM public.tos os
JOIN public.tlis_mat lm
  ON lm.cod_empresa = os.cod_empresa
 AND lm.cod_os = os.codigo
JOIN public.tproduto p
  ON p.cod_empresa = lm.cod_empresa
 AND p.codigo = lm.cod_produto
LEFT JOIN public.tos_aux aux
  ON aux.cod_empresa = lm.cod_empresa
 AND aux.cod_os = lm.cod_os
 AND aux.codigo = lm.cod_os_aux
WHERE os.concluido = 0
  AND os.aprovado = 1
  AND os.cancelado = 0
  AND os.n_os NOT LIKE 'E%'
  AND p.cod_familia <> 22
  AND p.inativo = 0
  AND COALESCE(lm.destino, 0) <> 3
  AND (
    COALESCE(lm.processado, 0) <> 1
    OR COALESCE(lm.qtde_solicitada, 0) > 0
  );
