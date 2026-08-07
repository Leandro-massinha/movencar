INSERT INTO "Module" ("id", "code", "name", "status", "isCore", "createdAt", "updatedAt") VALUES
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'core', 'Nucleo da plataforma', 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'customers', 'Clientes', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'vehicles', 'Veiculos', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'workshop', 'Oficina', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'finance', 'Financeiro', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'crm', 'CRM', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'yard', 'Patio', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ((md5(random()::text || clock_timestamp()::text))::uuid, 'tools-assets', 'Ferramentas e ativos', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "CompanyModule" ("companyId", "moduleId", "status", "activatedAt", "createdAt", "updatedAt")
SELECT company."id", module."id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
CROSS JOIN "Module" module
WHERE module."code" IN ('core', 'customers', 'vehicles', 'workshop', 'finance', 'crm', 'yard', 'tools-assets')
ON CONFLICT ("companyId", "moduleId") DO NOTHING;
