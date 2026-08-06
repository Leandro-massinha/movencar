# Database

PostgreSQL 16 is supported. Prisma migrations are authoritative; do not use `prisma db push` in shared environments.

Create a dedicated `movencar` database and `movencar_app` role, configure `backend/.env`, then run `npm run prisma:generate`, `npm run prisma:migrate` and `npm run prisma:seed`.

The database and role must never be shared with Painel MEG. PostgreSQL stays bound to localhost.
