
const { optimizeArticleOrder } = require('./web/src/utils/layoutOptimizer');

const mockArticles = [
    { id: '1', summary: 'Short summary', impact_score: 5, zero_echo_score: 2, url: 'http://a.com' },
    { id: '2', summary: 'Longer summary '.repeat(20), impact_score: 8, zero_echo_score: 1, url: 'http://b.com' }
];

console.log("Starting optimization...");
try {
    const result = optimizeArticleOrder(mockArticles);
    console.log("Optimization success!", result.length);
} catch (e) {
    console.error("Optimization failed:", e);
}
