# MOVENCAR - Design System

## Regras estruturais

- Botao padrao: `h-10`, raio `6px`, icone Lucide de `16px`, texto sem quebra.
- Icon button: `40x40px`, sempre com `aria-label` e tooltip nativo.
- Campos: `h-10`, mesma borda, raio e foco do botao.
- Cards: raio maximo `8px`, sem cards decorativos aninhados.
- Acoes de formulario ficam em uma unica barra alinhada a direita, com mesma altura e largura minima.
- Tabelas usam cabecalho fixo visual, linhas de 64px ou mais e rolagem horizontal no mobile.
- Badges podem ser pills; comandos nao.

As primitives vivem em `src/components/ui.tsx`. Nao replique classes de botao ou campo em paginas.
