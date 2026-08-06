# Multi-tenancy

Every tenant-owned row has `companyId`. The API derives it only from the verified access token and active database session (`req.auth.companyId`). Request data cannot select another company.

Queries use compound conditions such as `{ id, companyId }`. Branch access also verifies the branch's company. Cross-tenant misses look like missing records. `TenantTestResource` continuously tests list, read, create, update and delete isolation.

PostgreSQL RLS is deferred until connection-pool tenant context can be configured atomically; incomplete RLS would create false confidence.
