const fetch = require('node-fetch'); // Needs node-fetch or use native fetch in node 18+

async function checkApi() {
    try {
        console.log('Fetching http://localhost:3000/api/articles...');
        const res = await fetch('http://localhost:3000/api/articles');
        const data = await res.json();

        console.log('--- API Response Summary ---');
        console.log('Source:', data.source);
        console.log('Current Date:', data.currentDate);
        console.log('Available Dates:', data.availableDates);
        console.log('Article Count:', data.articles ? data.articles.length : 0);

        if (data.articles && data.articles.length > 0) {
            console.log('--- Top 3 Articles ---');
            data.articles.slice(0, 3).forEach((a, i) => {
                console.log(`[${i}] ${a.title_ko} | Date: ${a.crawled_at} | Source: ${a.source}`);
            });
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

// simple polyfill if needed or just run with strict node
if (!global.fetch) {
    console.log("Node environment might fetch. If this fails, I'll use a simpler http request.");
    // In node 18+ global.fetch exists. If typically older node, might fail. 
    // Let's assume standard environment or Use http module if needed.
    // Actually, let's just use http module to be safe from dependency issues.
}

checkApi();
