# Modelo de Dados Customer 360

`Customer` continua canônico. Nome, tipo, CPF/CNPJ normalizado e data de nascimento permanecem nele. CPF/CNPJ não é copiado para perfis; `birthDate` usa PostgreSQL `DATE` e não é obrigatório para abrir OS.

`CustomerIdentityProfile` guarda dados civis opcionais de PF. `CustomerContact` é a fonte canônica de longo prazo dos múltiplos contatos, com valor original, valor normalizado, finalidade, principalidade, atividade e verificação. Os campos legados `email`, `phone` e `whatsapp` são projeções temporárias: escritas antigas sincronizam o contato principal e criar/desativar um principal sincroniza a projeção legada. Desativar pode deixar o cliente sem principal; não há promoção automática sem escolha do operador.

Telefone e WhatsApp são comparados somente pelos dígitos informados, entre 8 e 15, sem acrescentar DDI brasileiro. E-mail é aparado e convertido para lowercase apenas na representação normalizada. PHONE e WHATSAPP com o mesmo número continuam registros distintos porque representam canais semanticamente diferentes.

`CustomerAddress` foi evoluído, sem tabela concorrente, com tipo, referência e código IBGE. Endereços legados recebem `OTHER`, valor semanticamente neutro. A política mantém no máximo um endereço principal ativo por cliente. `CustomerFiscalProfile` complementa o cadastro com indicador de contribuinte, IE/IM e referência tenant-safe a um endereço do próprio cliente; CPF/CNPJ e nome continuam no Customer. O profile é a fonte canônica de IE/IM, enquanto `Customer.stateRegistration` permanece como projeção bidirecional de compatibilidade.

`CustomerRelationship` liga dois Customers sem representar propriedade de Vehicle e rejeita duplicata ativa. Pessoas corporativas que precisam de identidade operacional completa tornam-se Customer relacionado; contatos informais permanecem `CustomerContact`, evitando `CustomerContactPerson` redundante. Preferência operacional é 1:1 e separada dos eventos imutáveis de consentimento. Retries de consentimento usam `Idempotency-Key`; a chave não é retornada pela API.

Níveis progressivos: identificação mínima; cadastro recomendado; dados exigidos pelo contexto fiscal; enriquecimento. A completude é calculada na leitura e nunca armazenada como verdade redundante.
