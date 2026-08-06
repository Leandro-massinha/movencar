# Deployment

Build frontend and backend separately. `ecosystem.config.cjs` creates only `movencar-api` and does not replace existing PM2 processes.

Suggested Nginx routing for a dedicated MovenCar host:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3334/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location / { try_files $uri $uri/ /index.html; }
```

Back up the site file, inspect the diff and run `nginx -t` before reload. Production must use HTTPS; never expose port 3334 or PostgreSQL.
