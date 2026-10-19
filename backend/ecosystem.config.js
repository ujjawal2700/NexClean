// Run from backend/: pm2 start ecosystem.config.js
// Build first with npm run build. Application settings come from backend/.env.
module.exports = {
  apps: [
    {
      name: "nexclean-api",
      cwd: __dirname,
      script: "./dist/index.js",
      exec_mode: "cluster",
      instances: 4,
      // Keep PM2's default NODE_APP_INSTANCE: worker 0 owns scheduled jobs.
      instance_var: "NODE_APP_INSTANCE",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      // The backend allows up to 3 seconds to close active connections.
      kill_timeout: 5000,
      listen_timeout: 10000,
      time: true,
    },
  ],
};
