# Modelo de Dados Customer 360

`Customer` continua canônico. Nome, tipo, CPF/CNPJ normalizado e data de nascimento permanecem nele. CPF/CNPJ não é copiado para perfis; `birthDate` usa PostgreSQL `DATE` e não é obrigatório para abrir OS.

`CustomerIdentityProfile` guarda dados civis opcionais de PF. `CustomerContact` é a fonte canônica dos múltiplos contatos, com valor original, valor normalizado, finalidade, principalidade, atividade e verificação. Os campos legados `email`, `phone` e `whatsapp` permanecem temporariamente compatíveis e são sincronizados para o contato principal.

`CustomerAddress` foi evoluído, sem tabela concorrente, com tipo, referência e código IBGE. A política mantém no máximo um endereço principal ativo por cliente. `CustomerFiscalProfile` complementa o cadastro com indicador de contribuinte, IE/IM e referência tenant-safe a um endereço do próprio cliente; CPF/CNPJ e nome continuam no Customer.

`CustomerRelationship` liga dois Customers sem representar propriedade de Vehicle. Pessoas corporativas que precisam de identidade operacional completa tornam-se Customer relacionado; contatos informais permanecem `CustomerContact`, evitando `CustomerContactPerson` redundante. Preferência operacional é 1:1 e separada dos eventos imutáveis de consentimento.

Níveis progressivos: identificação mínima; cadastro recomendado; dados exigidos pelo contexto fiscal; enriquecimento. A completude é calculada na leitura e nunca armazenada como verdade redundante.
