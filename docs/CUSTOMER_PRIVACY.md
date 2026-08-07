# Privacidade do Customer 360

Todas as extensões carregam `companyId`, usam FKs compostas e recebem tenant exclusivamente da sessão. APIs de lista continuam enxutas; o endpoint de profile é uma leitura explícita protegida por `customers.view`.

AuditLog registra nomes de campos, tipos, status e IDs técnicos necessários, nunca CPF/CNPJ, RG, telefone, e-mail, endereço, data de nascimento ou texto sensível completo. Contato preenchido começa não verificado. Verificação exige instante e origem coerentes.

Deduplicação retorna somente nome, ID tenant-local e evidência mascarada. Dados completos continuam disponíveis nos fluxos operacionais autorizados existentes; masking não substitui autorização. Consentimentos são eventos históricos e não podem ser atualizados ou apagados pela API.

Preferir WhatsApp para avisos de uma OS é preferência operacional e nunca concede marketing. O estado atual de um consentimento é o evento mais recente por tipo/versão; concessão e revogação permanecem preservadas.
