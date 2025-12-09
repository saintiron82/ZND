const fs = require('fs');
const path = require('path');

console.log('--- Checking Web Path Resolution ---');
console.log('Current Working Directory (process.cwd()):', process.cwd());

const supplierDataPath = path.join(process.cwd(), '../supplier/data');
console.log('Target Data Path:', supplierDataPath);

if (fs.existsSync(supplierDataPath)) {
    console.log('✅ Supplier data directory FOUND.');
    try {
        const dirs = fs.readdirSync(supplierDataPath);
        console.log('Contents:', dirs);
    } catch (e) {
        console.log('❌ Error reading directory:', e.message);
    }
} else {
    console.log('❌ Supplier data directory NOT FOUND using this path.');
    console.log('please check if we should be using "../../supplier/data" or similar depending on where this script runs vs where the app runs.');
}
