# Security Checklist

- Dedicated database and least-privilege role
- Secrets outside Git and rotated by environment
- HTTPS and secure HttpOnly refresh cookie
- Explicit CORS origins, Helmet and body limits
- Rate-limited login and refresh
- Password and token hashes never logged
- Tenant conditions on every tenant query
- Permission and branch middleware
- Session revocation and refresh rotation tests
- Backup, migration and rollback verification
- Dependency review before production
