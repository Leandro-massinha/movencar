module.exports = {
  apps: [{
    name: 'movencar-api',
    cwd: '/home/leandro/movencar/backend',
    script: 'dist/src/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '350M',
    restart_delay: 3000,
    time: true,
    env: { NODE_ENV: 'production' }
  }]
}
