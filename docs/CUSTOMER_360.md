# Customer 360°

## Entidade canônica

`Customer` permanece a identidade compartilhada por todos os domínios. Não serão criados clientes paralelos para Fiscal, CRM, Oficina ou Vendas. Campos universais continuam no cadastro; dados repetíveis ou especializados usam entidades complementares tenant-safe.

## Classificação das propostas

### Implementado

- perfis de identidade e fiscal 1:1;
- contatos múltiplos normalizados, verificáveis e com um principal ativo por tipo;
- endereço existente evoluído com tipo, referência, IBGE e principalidade protegida no banco;
- relacionamentos dirigidos, preferência operacional, consentimentos históricos, deduplicação assistida e completude calculada.

### Preparar e documentar

- `CustomerContact`: múltiplos telefones, e-mails e WhatsApps, com tipo, finalidade, principalidade e pessoa responsável.
- `CustomerIdentityProfile` e `CustomerFiscalProfile`: RG, órgão emissor, inscrições e dados fiscais sem inflar `Customer`.
- evolução de `CustomerAddress` com finalidade (`RESIDENTIAL`, `COMMERCIAL`, `BILLING`, `DELIVERY`, `FISCAL`, `BRANCH`, `OTHER`). A tabela existente e seus dados serão preservados.
- `CustomerRelationship`: vínculo dirigido entre clientes, com tipo, vigência e contexto; não substitui contatos.
- `CustomerCommunicationPreference` e `CustomerConsent`: preferência operacional separada da prova jurídica de consentimento, incluindo finalidade, origem, versão, concessão e revogação.

Os campos legados continuam disponíveis durante a transição e foram backfilled para os novos contatos. Customer permanece a fonte de CPF/CNPJ, nome e nascimento.

### Adiar

- telas em abas, CRM, marketing, perfil fiscal funcional, financeiro e documentos transacionais, até seus casos de uso serem aprovados.

## Regras

Todas as extensões carregam `companyId`, usam referências compostas e nunca aceitam tenant do cliente HTTP. Contatos e endereços admitem apenas um principal ativo por finalidade quando a feature for migrada. Consentimentos são históricos, não soft-deletados. A futura visão 360 agrega dados por leitura; não copia fontes transacionais.

Deduplicação será assistida por documento normalizado e, como sinais secundários, telefone/e-mail normalizados. O sistema apenas alerta “Possível cliente já cadastrado”; nunca funde pessoas automaticamente. Dado preenchido não equivale a verificado. RG, telefone, e-mail e documentos completos não entram em logs ou metadata de auditoria sem finalidade explícita.

## Experiência futura

Resumo, Contatos, Endereços, Veículos, Atendimentos, Financeiro, Documentos e CRM usarão carregamento progressivo. A API pública não exporá `companyId`, chaves de storage, metadata interna ou registros revogados sem contexto.
