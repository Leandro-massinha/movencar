# Backend Architecture

The MovenCar API lives in `backend/` and is an independent Node.js, TypeScript, Express and Prisma application. PostgreSQL is the system of record; the frontend never accesses it directly.

Request flow: request ID, structured logging, Helmet, restricted CORS, JSON size limit, validation, authentication, authorization, tenant-scoped query and centralized error handling. Business modules are intentionally outside Stage 2.
