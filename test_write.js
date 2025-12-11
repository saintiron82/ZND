
const fs = require('fs');
const path = require('path');

const targetDir = 'c:\\Users\\saint\\ZND\\web\\data_cache';
const logFile = 'c:\\Users\\saint\\ZND\\web\\debug_manual.txt';

console.log('Testing write permissions...');

try {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log('Created directory:', targetDir);
    } else {
        console.log('Directory exists:', targetDir);
    }

    fs.writeFileSync(logFile, 'Manual write test success at ' + new Date().toISOString());
    console.log('Wrote log file:', logFile);
} catch (e) {
    console.error('Write failed:', e);
}
