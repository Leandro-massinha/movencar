# MOVENCAR

Fundacao multiempresa de um SaaS para gestao de oficinas automotivas. O frontend React aprovado permanece na raiz e a API isolada Express/PostgreSQL fica em `backend/`.

## Tecnologias

React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios, React Hook Form, Zod, Recharts, Lucide, Vitest e Testing Library.

## Executar

```bash
cp .env.example .env
npm install
npm run dev
```

No login demonstrativo, use os dados preenchidos. `VITE_USE_MOCKS=true` preserva os mocks; use `false` somente depois de configurar e popular o banco dedicado.

Nenhum segredo deve ser inserido no frontend. Consulte `docs/BACKEND_ARCHITECTURE.md`, `docs/MULTI_TENANCY.md`, `docs/AUTHENTICATION.md`, `docs/SESSION_POLICY.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md` e `docs/SECURITY_CHECKLIST.md`.

## Estrutura

- `src/components`: primitives visuais e tabelas reutilizaveis.
- `src/config`: menu e configuracoes estaticas.
- `src/contexts`: sessao e tenant demonstrativos.
- `src/layouts`: casca autenticada responsiva.
- `src/pages`: telas por modulo.
- `src/routes`: rotas protegidas e permissoes.
- `src/services`: cliente HTTP e revogacao de sessao.
- `src/test`: testes automatizados.
- `docs`: arquitetura, seguranca, permissoes e design system.

## Qualidade

```bash
npm run lint
npm test
npm run build
```

## Documentacao

- `docs/ARCHITECTURE.md`: fronteiras, multiempresa e evolucao tecnica.
- `docs/DESIGN_SYSTEM.md`: medidas e regras visuais.
- `docs/SECURITY.md`: modelo de sessao unica e isolamento.
- `docs/PERMISSIONS.md`: matriz inicial de autorizacao.
- `AGENTS.md`: contexto persistente para futuras conversas.

## Estender o sistema

Para criar uma pagina, adicione o componente em `src/pages`, registre a rota protegida em `src/routes/AppRoutes.tsx` e use apenas as primitives de `src/components/ui.tsx`. Para inclui-la no menu, acrescente o item em `src/config/navigation.ts`. Novas permissoes entram primeiro em `src/types/auth.ts`, depois na rota e no menu; o backend futuro continuara sendo a autoridade final.
