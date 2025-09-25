module.exports = {
  apps: [{
    name: 'flotix-backend',
    script: 'npm',
    args: 'start',
    cwd: './',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000
  }]
};