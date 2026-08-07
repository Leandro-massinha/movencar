# MOVENCAR - Contexto para agentes

Este repositorio e isolado do Painel MEG. O produto se chama MOVENCAR.

## Isolamento obrigatorio

O MOVENCAR nao pode ter qualquer dependencia ou comunicacao com o Painel MEG. Nao compartilhar arquivos, codigo, componentes, banco de dados, APIs, credenciais, variaveis de ambiente, processos, diretorios de upload, filas, cache, dominio ou configuracao de proxy. Toda integracao futura deve pertencer exclusivamente ao MOVENCAR. Antes de qualquer alteracao de infraestrutura, confirmar que o escopo permanece em `/home/leandro/movencar` e em servicos exclusivos do MOVENCAR.

Antes de editar UI, leia `DESIGN_SYSTEM.md`. Reutilize `src/components/ui.tsx`; nao crie botoes, campos ou cards com medidas locais. Preserve acessibilidade, responsividade e as protecoes de rota. Rode `npm run lint`, `npm test` e `npm run build` antes de concluir.

Toda experiência visível ao usuário final do MovenCar deve utilizar Português do Brasil (pt-BR) por padrão. Código interno, modelos, APIs e enums podem permanecer em inglês.

Toda nova página, modal, mensagem, botão, tabela, filtro e validação deve seguir o glossário oficial em `docs/PRODUCT_LANGUAGE.md`.

Nenhuma entrada de veículo deve assumir ausência de avarias ou funcionamento correto de componente não verificado. O MovenCar deve distinguir explicitamente OK, anormalidade, não verificado e não aplicável.

Relato do cliente, condição observada no Check-in, resultado do PDC, resultado do teste de rodagem e diagnóstico técnico são registros distintos e nunca devem sobrescrever uns aos outros.

Todo veículo que entra fisicamente para atendimento deve possuir Ordem de Serviço, mesmo quando o atendimento terminar apenas em diagnóstico, avaliação ou orçamento não aprovado.

Registros documentais confirmados pelo cliente devem ser versionados e não podem ser alterados silenciosamente.
