# Authentication

Login requires company code, normalized e-mail and password. Passwords use bcrypt cost 12. Five failures lock the account for 15 minutes.

The short access JWT stays in browser memory. The refresh JWT is in an HttpOnly cookie; PostgreSQL stores only its SHA-256 hash. Refresh rotates it. Production requires HTTPS and `COOKIE_SECURE=true`.

Frontend demo behavior remains available with `VITE_USE_MOCKS=true`; use `false` for real auth.
