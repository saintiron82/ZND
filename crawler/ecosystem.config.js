module.exports = {
    apps: [{
        name: 'znd-crawler',
        script: 'scheduler.py',
        interpreter: 'd:/ZND/desk/.venv/Scripts/python.exe',
        cwd: 'd:/ZND/crawler',
        watch: false,
        autorestart: true,
        max_restarts: 10,
        restart_delay: 5000,
        env: {
            PYTHONPATH: 'd:/ZND',
            PYTHONIOENCODING: 'utf-8'
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }]
};
