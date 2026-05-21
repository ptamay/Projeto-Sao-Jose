module.exports = {
  apps: [
    {
      name: "sao-jose",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0",
      cwd: "e:\\Projeto Sao Jose",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      out_file: "e:\\Projeto Sao Jose\\logs\\app.log",
      error_file: "e:\\Projeto Sao Jose\\logs\\error.log",
      merge_logs: true,
    },
  ],
};
