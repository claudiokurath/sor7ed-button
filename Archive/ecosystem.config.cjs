module.exports = {
  apps: [
    {
      name: 'api',
      cwd: '/home/user/webapp/api',
      script: 'npx',
      args: 'tsx --env-file=.env src/index.ts',
      env: { NODE_ENV: 'development' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'worker',
      cwd: '/home/user/webapp/worker',
      script: 'npx',
      args: 'tsx --env-file=.env src/index.ts',
      env: { NODE_ENV: 'development' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'web',
      cwd: '/home/user/webapp/web',
      script: 'npx',
      args: 'next dev -p 3000 -H 0.0.0.0',
      env: { NODE_ENV: 'development' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
