# MOVENCAR - Arquitetura

O MovenCar e um monolito modular com React SPA, API Node/Express e PostgreSQL. `routes` controla acesso, `layouts` compoe a casca autenticada, `components` concentra o design system e `services` isola HTTP. As fronteiras e dependencias completas estao em `PLATFORM_ARCHITECTURE.md` e `DOMAIN_MAP.md`.

## Idioma do produto

A experiência visível adota pt-BR como idioma oficial. Textos e traduções de enums ficam centralizados em `src/i18n/pt-BR.ts`; datas, moeda, números e identificadores brasileiros usam `src/i18n/formatters.ts`. Código interno e contratos da API permanecem em inglês, sem alterar valores persistidos. O glossário normativo está em `docs/PRODUCT_LANGUAGE.md`.

## Isolamento do produto

MOVENCAR e Painel MEG sao sistemas completamente independentes. Eles nao compartilham codigo, dados, APIs, configuracoes, credenciais, processos ou infraestrutura de aplicacao. Uma indisponibilidade, implantacao ou alteracao no MOVENCAR nao pode afetar o Painel MEG, e vice-versa.

## Fronteiras

- A UI nunca acessa credenciais ou tokens persistidos.
- O cliente Axios usa cookies `HttpOnly` via `withCredentials`.
- TanStack Query sera a fonte para estado remoto; Context fica restrito a sessao e tenant.
- Toda entidade empresarial deve carregar `companyId` quando aplicavel; `branchId` existe somente quando o dado possui escopo de filial. A autorizacao real e revalidada no servidor.
- Acesso comercial exige modulo ativo da empresa e permissao do usuario; ocultacao visual nao e controle de seguranca.
- Eventos 401/419/440 revogam a sessao local de modo centralizado.

## Evolucao

Conectar os mocks gradualmente a contratos versionados da API. Cada dominio cresce dentro do monolito sem copiar entidades Core ou criar dependencias circulares. Microservicos ficam adiados ate haver necessidade operacional comprovada.
