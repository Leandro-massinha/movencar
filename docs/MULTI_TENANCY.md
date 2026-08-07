# Multi-tenancy

Every tenant-owned row has `companyId`. The API derives it only from the verified access token and active database session (`req.auth.companyId`). Request data cannot select another company.

Queries use compound conditions such as `{ id, companyId }`. Branch access also verifies the branch's company. Cross-tenant misses look like missing records. `TenantTestResource` continuously tests list, read, create, update and delete isolation.

PostgreSQL RLS is deferred until connection-pool tenant context can be configured atomically; incomplete RLS would create false confidence.

`CompanyModule` is tenant-owned. Module checks derive the company only from `req.auth.companyId`; callers cannot select a company. Deactivation, suspension or expiry blocks access without deleting domain data. Tenant-owned extensions, attachments and transactional snapshots must use compound tenant-safe foreign keys whenever their parent also carries `companyId`.

Business types never create separate databases or schemas. A future `CompanyBusinessType` association will remain scoped to one company and will influence presets only, not authorization.
