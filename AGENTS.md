# MOVENCAR - Contexto para agentes

Este repositorio e isolado do Painel MEG. O produto se chama MOVENCAR.

## Isolamento obrigatorio

O MOVENCAR nao pode ter qualquer dependencia ou comunicacao com o Painel MEG. Nao compartilhar arquivos, codigo, componentes, banco de dados, APIs, credenciais, variaveis de ambiente, processos, diretorios de upload, filas, cache, dominio ou configuracao de proxy. Toda integracao futura deve pertencer exclusivamente ao MOVENCAR. Antes de qualquer alteracao de infraestrutura, confirmar que o escopo permanece em `/home/leandro/movencar` e em servicos exclusivos do MOVENCAR.

Antes de editar UI, leia `DESIGN_SYSTEM.md`. Reutilize `src/components/ui.tsx`; nao crie botoes, campos ou cards com medidas locais. Preserve acessibilidade, responsividade e as protecoes de rota. Rode `npm run lint`, `npm test` e `npm run build` antes de concluir.

Toda experiência visível ao usuário final do MovenCar deve utilizar Português do Brasil (pt-BR) por padrão. Código interno, modelos, APIs e enums podem permanecer em inglês.

Toda nova página, modal, mensagem, botão, tabela, filtro e validação deve seguir o glossário oficial em `docs/PRODUCT_LANGUAGE.md`.
