const isWin = process.platform === 'win32';
const fs = require('fs');
const path = require('path');

// 스케줄 설정 파일 로드 및 활성화된 스케줄만 cron으로 병합
let crawlSchedule = '30 0,6,12,18 * * *'; // 기본값
try {
    const configPath = path.join(__dirname, 'desk', 'config', 'auto_crawl_schedule.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (config.schedules && Array.isArray(config.schedules)) {
        // enabled=true인 스케줄만 필터링하여 cron 표현식 생성
        const enabledSchedules = config.schedules.filter(s => s.enabled);

        if (enabledSchedules.length > 0) {
            // 각 스케줄의 분,시 추출하여 병합
            const minutes = new Set();
            const hours = new Set();

            enabledSchedules.forEach(s => {
                const parts = s.cron.split(' ');
                if (parts.length >= 2) {
                    minutes.add(parts[0]);
                    hours.add(parts[1]);
                }
            });

            // 분이 모두 같으면 시간만 병합, 아니면 개별 처리
            const minArray = [...minutes];
            const hourArray = [...hours].sort((a, b) => parseInt(a) - parseInt(b));

            if (minArray.length === 1) {
                crawlSchedule = `${minArray[0]} ${hourArray.join(',')} * * *`;
            } else {
                // 분이 다르면 첫 번째 스케줄 사용 (복잡한 케이스)
                crawlSchedule = enabledSchedules[0].cron;
            }
        }
    }
} catch (e) {
    console.log('⚠️ auto_crawl_schedule.json 로드 실패, 기본 스케줄 사용');
}

module.exports = {
    apps: [
        {
            name: 'zed-web',
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
            name: 'zed-crawler',
            script: 'auto_crawl.py',
            cwd: './desk',
            interpreter: isWin ? 'python' : '/home/saintiron82/ZED/desk/venv/bin/python3',
            instances: 1,
            autorestart: false,
            cron_restart: crawlSchedule, // config/auto_crawl_schedule.json에서 로드
            watch: false,
        },
    ],
};
