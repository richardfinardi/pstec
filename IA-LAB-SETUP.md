# PSTEC — Laboratorio de IA generativa (teste)

## O que ja esta pronto

- Tela: `https://consultoriarf.net/pstec/ia-lab.html` (sem link no menu).
- Worker: `infra/pstec-ia-worker.js` (codigo pronto para Cloudflare Workers).
- O modelo utilizado e `gpt-6-luna`, via **OpenAI Responses API**.
- Leitura contextual de arquivos HTML, JS, CSS, SQL, Markdown, TXT, JSON, Python e TypeScript do repositorio `richardfinardi/pstec`.
- Pesquisa feita em todas as pastas relevantes, com selecao de trechos e referencias de arquivos/linhas.
- Historico de conversa somente nesta sessao do navegador; atualizacao do indice do GitHub a cada 5 minutos.

## Ativar — Cloudflare

1. No Cloudflare, abra **Workers & Pages** -> **Create** -> **Worker**. Crie um Worker, por exemplo `pstec-ia`.
2. Em **Edit code**, substitua pelo conteudo de [infra/pstec-ia-worker.js](infra/pstec-ia-worker.js) e clique **Deploy**.
3. Em **Settings** -> **Variables and Secrets**, adicione estes dois **Secrets**:
   - `OPENAI_API_KEY` = chave da API OpenAI (nao e a assinatura do ChatGPT).
   - `IA_LAB_SENHA` = crie uma senha longa e exclusiva para este laboratorio.
4. Copie a URL publicada, no formato `https://pstec-ia.<seu-subdominio>.workers.dev`.
5. Abra `https://consultoriarf.net/pstec/ia-lab.html` **apos entrar no portal PSTEC**, cole a URL do Worker, digite a mesma senha do passo 3 e clique **Conectar laboratorio**.

A chave OpenAI fica somente no Cloudflare. A senha de acesso fica em memoria de sessao no navegador, e a URL do Worker e salva para facilitar um proximo acesso.

## Perguntas sugeridas

- Como funciona a tela de Conferencia de Remocao? Em que situacao permite excluir?
- Onde sao calculados os indicadores de prazo do faturamento?
- Quais campos e status sao utilizados na tela de Carteira?
- Quais consultas SQL existem na pasta `sql/` e quais tabelas elas cruzam?
- Como funciona a persistencia dos filtros ao dar F5 na tela de Producao?

## Importante sobre o escopo

A IA entende os **arquivos de codigo e queries versionados neste repositorio**. Ela **nao le**:
- Dados atuais dos endpoints `/producao`, `/capital`, `/carteira`, `/faturamento`, etc.
- Dados em tempo real do PostgreSQL/SQL Server, imagens e ZIPs.
- O codigo do `main.py` da API, se ele nao existir neste repositorio.

Para fazer perguntas como "quantos orcamentos estao atrasados hoje?", "quanto faturou ontem?" ou "quais OS estao pendentes?", precisaremos de uma segunda etapa conectando o Worker aos endpoints de consulta autorizados e validando o login/perfil do usuario. Isso **nao esta habilitado** neste teste.

## Seguranca e custos

- O Worker exige senha independente antes de chamar a API OpenAI.
- O front-end nao recebe a chave API OpenAI.
- A IA nao executa SQL, nao grava no banco, nem altera arquivos.
- O link e *oculto do menu*, mas **nao e uma protecao de acesso por si so**. O site exige login e o Worker exige senha de laboratorio.
- Trechos do repositorio sao transmitidos a OpenAI para responder perguntas. Nao utilize este teste com arquivos privados ou sigilosos sem autorizacao.
- O uso da API OpenAI e cobrado por tokens. O Worker limita o tamanho de perguntas, trechos recuperados e respostas para reduzir consumo.

## Diagnostico

- `GET https://<worker>/health`: deve responder `{"ok":true,"service":"PSTEC IA Lab"}`.
- `401`: senha incorreta.
- `503`: falta cadastrar algum dos dois secrets no Worker.
- `502`: erro na API OpenAI (credenciais, saldo, limite).
- `500` relacionado a GitHub: GitHub temporariamente indisponivel, limite ou problema de indice.
- Se o navegador exibir erro de CORS, verifique se o site esta publicado em `consultoriarf.net`, `www.consultoriarf.net` ou `richardfinardi.github.io`; sao as origens permitidas no codigo.

Este teste nao modifica a indexacao do menu PSTEC e pode ser removido apagando `ia-lab.html` e desativando o Worker.


## Versao 2: dados reais da API PSTEC (somente GET)

O laboratorio agora tem dois modos:

- **Codigo GitHub**: preserva o funcionamento anterior e suas referencias por arquivo.
- **Dados reais (GET)**: a IA seleciona ate duas fontes autorizadas, le os dados no momento da pergunta, identifica os campos existentes, planeja filtros/agrupamentos, executa as contas no Worker e responde com fontes e quantidade de registros.

**Importante: atualizar manualmente o Worker no Cloudflare** depois de atualizar este arquivo no GitHub.

1. Cloudflare -> Workers & Pages -> pstec-ia -> Edit code.
2. Abra \`infra/pstec-ia-worker.js\` -> Raw -> copie integralmente.
3. Substitua o codigo completo do editor e clique em **Deploy**.
4. F5 em \`https://consultoriarf.net/pstec/ia-lab.html\`.
5. Selecione **Dados reais (GET)** e pergunte:
   - "Quais clientes estao com pedidos atrasados e qual o valor a faturar?"
   - "Quanto faturamos em outubro de 2026 versus setembro de 2026?"
   - "Quais materiais estao aguardando compra e ha quantos dias?"

Ja usa \`OPENAI_API_KEY\` e \`IA_LAB_SENHA\` configurados anteriormente. Nao exige novos secrets.

### Restricoes e cuidados

- Endpoints fixos autorizados: /CARTEIRA, /producao, /faturamento, /faturamento_indicadores, /capital_carteira, /capital_faturamento, /capital_financeiro, /00_compras_orcamentos, /01_compras_materiais, /03_compras_ocs, /06_compras_cotacoes e /remocao.
- Apenas requisicoes **GET**. Nao ha comandos de alteracao nem executa SQL arbitrario.
- O acesso ao Worker depende da senha \`IA_LAB_SENHA\`, mas ainda **nao ha verificacao server-side do perfil do usuario logado no ERP**. Utilize apenas como laboratorio restrito e nao divulgue a senha. Nao publique no menu dos usuarios antes de implementar autenticacao adequada.
- O Worker envia para a OpenAI o esquema de campos (com ate dois exemplos por campo) e os resultados calculados. Isso pode incluir informacoes empresariais. A OpenAI pode processar essas informacoes conforme as condicoes de API contratadas.
- Limite de **10 MB por endpoint**. Respostas maiores geram erro, em vez de apresentar total parcial. Alguns endpoints podem exigir futuramente versao agregada/paginada da API.
- A IA escolhe endpoints/campos, mas sua escolha e validada pelo Worker. Perguntas complexas ainda exigem validacao por um humano; nao confundir sugestao do modelo com dado verificado.
- Comparacao entre clientes de dois endpoints, se aparecer, e por texto normalizado, nao por codigo unico; pode nao equivaler a um JOIN de banco. Nao presumir conciliacao perfeita.
- Fontes como \`/faturamento\` podem ser granulares por item de NF. O Worker sinaliza risco de duplicidade ao somar campos de total de cabecalho da NF.
- O modo dados usa ate **tres chamadas OpenAI** por pergunta (selecionar fontes, planejar, responder), portanto consome mais tokens que o modo codigo.
- Se a API exigir login/autorizacao para GET server-to-server, vai retornar erro HTTP 401/403. Sera necessario implementar autenticação adequada da API na proxima etapa, sem mandar senhas do usuario para a IA.
- Para implantacao final, recomendo autenticacao server-side, controle por perfil, limite de chamadas, auditoria e rotas agregadas para bases maiores.

### Verificacao

A rota \`/health\` apenas confirma que o Worker esta ativo; **nao valida a chamada a API OpenAI nem acesso aos dados PSTEC**. O teste real so acontece ao usar \`/ask-data\` com a senha configurada.

