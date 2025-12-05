const isWin = process.platform === 'win32';

module.exports = {
    apps: [
        {
            name: 'znd-web',
            script: 'node',
            args: './node_modules/next/dist/bin/next start -p 8080',
            cwd: './web',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            },
        },
        {
            name: 'znd-crawler',
            script: 'crawler.py',
            cwd: './supplier',
            interpreter: isWin ? 'python' : '/home/saintiron82/ZND/supplier/venv/bin/python3',
            instances: 1,
            autorestart: false, // Don't restart automatically when it finishes
            cron_restart: '0 7,19 * * *', // Run twice daily at 07:00 and 19:00
            watch: false,
        },
    ],
};
