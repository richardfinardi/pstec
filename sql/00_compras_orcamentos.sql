-- PSTEC | 00 - ORCAMENTOS VINCULADOS AS OS (somente leitura)
-- CORRECAO: reproduz o vinculo GUID confirmado na query CARTEIRA enviada pelo usuario.
-- TOS -> TOS_SOLICITACAO_NECESSIDADE (cod_os)
--     -> TSOL_MAX_OS (guid_pai = guid_solicitacao)
--     -> TORCAMENTO_ITENS (guid_linha = guid_lm)
--     -> TORCAMENTO (cod_empresa + cod_orcamento).
-- Fallback pelo TOS.COD_ORCAMENTO, somente quando for realmente preenchido.
-- Saida: 1 linha por OS + orcamento; itens distintos agregados para evitar duplicidade.
-- Previsao: maior data de entrega entre os itens do orcamento (data limite da OS).
WITH os_ativas AS (
    SELECT os.cod_empresa,
           os.codigo AS cod_os,
           os.cod_orcamento,
           os.u_dt_renegociacao::date AS dt_renegociacao_os
    FROM public.tos os
    WHERE os.concluido = 0
      AND os.aprovado = 1
      AND os.cancelado = 0
),
map_item_os AS (
    SELECT DISTINCT
           sn.cod_empresa,
           sn.cod_os,
           sm.guid_lm AS guid_item_orcamento
    FROM os_ativas os
    JOIN public.tos_solicitacao_necessidade sn
      ON sn.cod_empresa = os.cod_empresa
     AND sn.cod_os = os.cod_os
    JOIN public.tsol_max_os sm
      ON sm.cod_empresa = sn.cod_empresa
     AND sm.guid_pai = sn.guid_solicitacao
),
via_guid AS (
    SELECT map.cod_empresa, map.cod_os,
           oi.cod_orcamento,
           oi.guid_linha AS guid_item_orcamento,
           oi.dt_previsao_entrega::date AS dt_prev_item,
           'GUID_ITEM_OS'::text AS origem,
           1 AS prioridade
    FROM map_item_os map
    JOIN public.torcamento_itens oi
      ON oi.cod_empresa = map.cod_empresa
     AND oi.guid_linha = map.guid_item_orcamento
     AND oi.nivel = 0
),
via_cod_orcamento AS (
    SELECT os.cod_empresa, os.cod_os,
           oi.cod_orcamento,
           oi.guid_linha AS guid_item_orcamento,
           oi.dt_previsao_entrega::date AS dt_prev_item,
           'TOS_COD_ORCAMENTO'::text AS origem,
           2 AS prioridade
    FROM os_ativas os
    JOIN public.torcamento_itens oi
      ON oi.cod_empresa = os.cod_empresa
     AND oi.cod_orcamento = os.cod_orcamento
     AND oi.nivel = 0
    WHERE os.cod_orcamento IS NOT NULL
),
todos AS (
    SELECT * FROM via_guid
    UNION ALL
    SELECT * FROM via_cod_orcamento
),
sem_duplicidades AS (
    SELECT DISTINCT ON (cod_empresa,cod_os,cod_orcamento,guid_item_orcamento)
           cod_empresa,cod_os,cod_orcamento,guid_item_orcamento,
           dt_prev_item,origem
    FROM todos
    ORDER BY cod_empresa,cod_os,cod_orcamento,guid_item_orcamento,prioridade
)
SELECT u.cod_empresa,
       u.cod_os,
       u.cod_orcamento AS cod_orcamento_vinculado,
       o.n_orcamento,
       o.cliente AS cliente_orcamento,
       o.versao,
       CONCAT(o.n_orcamento, o.versao) AS orcamento,
       COUNT(DISTINCT u.guid_item_orcamento)::integer AS quantidade_itens_orcamento,
       MIN(u.dt_prev_item)::date AS primeira_previsao_item,
       MAX(u.dt_prev_item)::date AS ultima_previsao_item,
       COALESCE(MAX(u.dt_prev_item),
                o.dt_previsao_entrega::date,
                o.dt_prevista_entrega::date) AS prev_entrega_orcamento,
       os.dt_renegociacao_os,
       COALESCE(os.dt_renegociacao_os,
                MAX(u.dt_prev_item),
                o.dt_previsao_entrega::date,
                o.dt_prevista_entrega::date) AS previsao_entrega_cliente,
       CASE WHEN os.dt_renegociacao_os IS NOT NULL THEN 'OS_U_DT_RENEGOCIACAO'
            WHEN MAX(u.dt_prev_item) IS NOT NULL THEN 'TORCAMENTO_ITENS_DT_PREVISAO_ENTREGA'
            WHEN o.dt_previsao_entrega IS NOT NULL THEN 'TORCAMENTO_DT_PREVISAO_ENTREGA'
            WHEN o.dt_prevista_entrega IS NOT NULL THEN 'TORCAMENTO_DT_PREVISTA_ENTREGA'
            ELSE 'SEM_PREVISAO' END AS origem_previsao,
       STRING_AGG(DISTINCT u.origem, ', ' ORDER BY u.origem) AS origem_vinculo
FROM sem_duplicidades u
JOIN os_ativas os
  ON os.cod_empresa=u.cod_empresa AND os.cod_os=u.cod_os
JOIN public.torcamento o
  ON o.cod_empresa=u.cod_empresa AND o.codigo=u.cod_orcamento
WHERE o.status = 1
  AND COALESCE(o.cancelado,0) = 0
GROUP BY u.cod_empresa,u.cod_os,u.cod_orcamento,
         o.n_orcamento,o.cliente,o.versao,o.dt_previsao_entrega,o.dt_prevista_entrega,
         os.dt_renegociacao_os
ORDER BY u.cod_empresa,u.cod_os,u.cod_orcamento;