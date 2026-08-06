# MOVENCAR - Seguranca

- Autenticacao atual e demonstrativa; nao use as credenciais ficticias em producao.
- Producao deve usar sessao em cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, rotacao e CSRF quando aplicavel.
- Tokens nao devem ir para `localStorage` ou logs.
- Tenant e filial enviados pelo cliente nunca substituem verificacao de escopo no backend.
- Revogacao de sessao deve invalidar todas as consultas em cache e registrar o evento de auditoria.
- Uploads futuros exigem validacao de MIME, tamanho, assinatura e armazenamento isolado.
