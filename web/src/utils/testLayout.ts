
import { LayoutOptimizer } from './layoutOptimizer';

const mockArticles = [
    { id: '1', impact_score: 9.0, zero_echo_score: 1.0, summary: 'Article 1 - Best' },
    { id: '2', impact_score: 8.0, zero_echo_score: 2.0, summary: 'Article 2 - Second' },
    { id: '3', impact_score: 7.0, zero_echo_score: 3.0, summary: 'Article 3 - Third' },
    { id: '4', impact_score: 6.0, zero_echo_score: 4.0, summary: 'Article 4 - Low' },
    { id: '5', impact_score: 5.0, zero_echo_score: 5.0, summary: 'Article 5 - Low' },
];

const optimizer = new LayoutOptimizer(10);
const result = optimizer.optimizeLayout(mockArticles);

console.log("Optimization Result Order:");
result.forEach((a, i) => {
    console.log(`[${i}] ID: ${a.id}, Cols: ${a.cols}, Rows: ${a.rows}`);
});

// Verification Logic
const a1 = result.find(a => a.id === '1');
const a2 = result.find(a => a.id === '2');
const a3 = result.find(a => a.id === '3');

if (!a1 || !a2 || !a3) {
    console.error("FAILED: Missing top articles in result");
    process.exit(1);
}

// 1. Verify Top 1 is ID 1 (Result index 0)
if (result[0].id !== '1') {
    console.error(`FAILED: First article is ${result[0].id}, expected 1`);
} else {
    console.log("PASS: Rank 1 is first.");
}

// 2. Verify Order in List (Rank 2 and 3 should follow)
// Note: result array is the PLACEMENT order (or the returned order).
// The optimizer returns `finalOrder`.
// If `finalOrder` preserves visual intent, then 2 and 3 should be index 1 and 2.
if (result[1].id !== '2') {
    console.error(`FAILED: Second article is ${result[1].id}, expected 2`);
} else {
    console.log("PASS: Rank 2 is second.");
}

if (result[2].id !== '3') {
    console.error(`FAILED: Third article is ${result[2].id}, expected 3`);
} else {
    console.log("PASS: Rank 3 is third.");
}

// 3. Verify Layout Positions (via debug if possible, but here we only have the list)
// The `optimizeLayout` returns `ArticleWithSize` which doesn't explicitly include the `row`/`col` unless we added it?
// `placeArticle` returns `PlacedArticle` which has `col/row`.
// But `optimizeLayout` returns `finalOrder` which is `ArticleWithSize[]`.
// `ArticleWithSize` in the interface does NOT have `row` or `col` (PLACEMENT coordinates). 
// It has `rows` and `cols` (DIMENSIONS).
// The placement coordinates are internal to `placements`.
// Wait, `optimizeLayout` implementation:
// `finalOrder.push(article)` -> article is `ArticleWithSize`.
// It does NOT attach the `col`/`row` position to the returned object.
// So `ArticleDisplay` re-calculates or just renders them in order?
// `ArticleDisplay.tsx`:
// `map((article, index) => ...`
// It just uses the CSS Grid `grid-flow-dense`.
// BUT, wait.
// If `ArticleDisplay` relies on `grid-flow-dense` (auto-placement), 
// then strict ORDER in the array DOES NOT guarantee strict visual position if sizes differ!
// CSS Grid auto-placement fills holes.
// If Article 1 is full width.
// Article 2 is small.
// Article 3 is small.
// Article 4 (Rank 4) is small.
// If we want Article 2 and 3 to be "Next", they should be next in DOM order.
// `grid-flow-dense` will pack them.
// If Article 2 is small (4 cols), Article 3 (4 cols).
// They will go next to each other.
// If Article 4 fits in a gap *before* Article 2? 
// Impossible if Article 2 comes first in DOM and there are no earlier gaps.
// Rank 1 (Full Width) leaves NO gaps above it.
// So Rank 2 will be first candidate for next row.
// Rank 3 will be next candidate.
// Rank 4 will be next.
// So DOM order IS critical.
// My `optimizeLayout` ensures `finalOrder` has Rank 1, 2, 3 first.
// And `ArticleDisplay` iterates `optimizedArticles.map`.
// So Rank 1, 2, 3 will be first in DOM.
// So `grid-flow-dense` will place them as early as possible.
// Since Rank 1 blocked the top.
// Rank 2 will be at top-most available (below Rank 1).
// Rank 3 will be after Rank 2.
// So the Order in Array IS the layout control.

// So my verification of the ARRAY ORDER is sufficient.

console.log("Verification Complete");
