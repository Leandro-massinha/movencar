# MOVENCAR - Arquitetura

Aplicacao React SPA organizada por dominio. `routes` controla acesso, `layouts` compoe a casca autenticada, `components` concentra o design system, `services` isola HTTP e `mocks` sustenta a demonstracao.

## Isolamento do produto

MOVENCAR e Painel MEG sao sistemas completamente independentes. Eles nao compartilham codigo, dados, APIs, configuracoes, credenciais, processos ou infraestrutura de aplicacao. Uma indisponibilidade, implantacao ou alteracao no MOVENCAR nao pode afetar o Painel MEG, e vice-versa.

## Fronteiras

- A UI nunca acessa credenciais ou tokens persistidos.
- O cliente Axios usa cookies `HttpOnly` via `withCredentials`.
- TanStack Query sera a fonte para estado remoto; Context fica restrito a sessao e tenant.
- Toda entidade futura deve carregar `tenantId` e `branchId`; a autorizacao real deve ser revalidada no servidor.
- Eventos 401/419/440 revogam a sessao local de modo centralizado.

## Evolucao

Conectar os mocks gradualmente a contratos versionados da API. Cada modulo pode ganhar `api`, `queries`, `schemas` e testes sem alterar a navegacao ou o design system.
