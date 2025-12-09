const http = require('http');

function checkApi() {
    console.log('Fetching http://localhost:8080/api/articles...');

    http.get('http://localhost:8080/api/articles', (res) => {
        let data = '';

        // A chunk of data has been received.
        res.on('data', (chunk) => {
            data += chunk;
        });

        // The whole response has been received.
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    console.error(`Error: Status Code ${res.statusCode}`);
                    console.log('Body snippet:', data.substring(0, 200));
                    return;
                }

                const json = JSON.parse(data);
                console.log('--- API Response Summary ---');
                console.log('Source:', json.source);
                console.log('Current Date:', json.currentDate);
                console.log('Available Dates:', json.availableDates);
                console.log('Article Count:', json.articles ? json.articles.length : 0);

                if (json.articles && json.articles.length > 0) {
                    console.log('--- Top 3 Articles ---');
                    json.articles.slice(0, 3).forEach((a, i) => {
                        console.log(`[${i}] ${a.title_ko} | Score: ${a.score} | Date: ${a.crawled_at} | Source: ${a.source}`);
                    });
                }
            } catch (e) {
                console.error('Error parsing JSON:', e.message);
                console.log('Raw Data:', data.substring(0, 500));
            }
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

checkApi();
