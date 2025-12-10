/**
 * Layout Optimizer - Gap-Filling Algorithm
 * 
 * Simulates CSS Grid layout, detects empty spaces (gaps),
 * and recommends high ZS-score articles to fill those gaps.
 */

import { LAYOUT_CONFIG } from '../config/layoutConfig';

export interface ArticleWithSize {
    id: string;
    cols: number;
    rows: number;
    zeroEchoScore: number;
    impactScore: number;
    summary: string;
    awards?: string[]; // Award badges: "Today's Headline", "Zero Noise Award", "Hot Topic"
    [key: string]: any; // Allow additional properties
}

interface GridCell {
    occupied: boolean;
    articleId?: string;
}

interface Gap {
    col: number;
    row: number;
    width: number;
    height: number;
    area: number;
}

interface PlacedArticle {
    article: ArticleWithSize;
    col: number;
    row: number;
}

// Deterministic hash for consistent width selection
const getHash = (str: string): number => {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};

// Calculate article size using the same physics logic as ArticleDisplay
const calculateArticleSize = (article: any): { cols: number; rows: number } => {
    const { constraints, physics, grid } = LAYOUT_CONFIG;

    const textLength = (article.summary || '').length;
    const score = article.impact_score || 0;
    const minW = constraints.minWidth;
    const maxW = constraints.maxWidth;

    // Random width based on ID hash
    const hash = getHash(article.id || '');
    const widthRange = maxW - minW + 1;
    let cols = minW + (hash % widthRange);

    // High impact bias
    if (score >= 7.0) {
        cols = Math.max(cols, 6);
    }
    cols = Math.min(cols, maxW);

    // Physics calculation
    const availableWidthPx = (cols * physics.colWidthPx) - physics.paddingPx - ((cols - 1) * grid.gap);
    const charsPerLine = availableWidthPx / physics.charWidthPx;
    const estimatedLines = Math.ceil(textLength / charsPerLine);
    const requiredHeightPx = physics.headerHeightPx + (estimatedLines * physics.lineHeightPx) + physics.paddingPx;

    // Grid quantization (10px steps)
    const gapPx = 16;
    const trackPx = grid.cellHeight;
    let rows = Math.ceil((requiredHeightPx + gapPx) / (trackPx + gapPx));

    // Safety Margin: Add 2 extra rows to prevent text cutoff
    rows = rows + 2;

    // Minimal floor
    const MIN_ROWS = 5;
    rows = Math.max(rows, MIN_ROWS);
    rows = Math.min(rows, 80);

    return { cols, rows };
};

export class LayoutOptimizer {
    private gridCols: number;
    private gridRows: number;
    private grid: GridCell[][];
    private placements: PlacedArticle[];
    private nextRow: number;

    constructor(gridCols: number = 10, initialRows: number = 100) {
        this.gridCols = gridCols;
        this.gridRows = initialRows;
        this.grid = this.createEmptyGrid(gridCols, initialRows);
        this.placements = [];
        this.nextRow = 0;
    }

    private createEmptyGrid(cols: number, rows: number): GridCell[][] {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({ occupied: false }))
        );
    }

    private expandGridIfNeeded(requiredRows: number): void {
        while (this.gridRows < requiredRows) {
            this.grid.push(
                Array.from({ length: this.gridCols }, () => ({ occupied: false }))
            );
            this.gridRows++;
        }
    }

    // Find first available position for an article (left-to-right, top-to-bottom)
    private findPosition(cols: number, rows: number, minRow: number = 0): { col: number; row: number } | null {
        for (let r = minRow; r < this.gridRows; r++) {
            for (let c = 0; c <= this.gridCols - cols; c++) {
                if (this.canPlace(c, r, cols, rows)) {
                    return { col: c, row: r };
                }
            }
            // Expand grid if we've searched too far
            if (r >= this.gridRows - rows - 1) {
                this.expandGridIfNeeded(this.gridRows + 10);
            }
        }
        // Fallback: append at end
        const newRow = Math.max(this.gridRows, minRow);
        this.expandGridIfNeeded(newRow + rows);
        return { col: 0, row: newRow };
    }

    private canPlace(col: number, row: number, cols: number, rows: number): boolean {
        this.expandGridIfNeeded(row + rows);

        for (let r = row; r < row + rows; r++) {
            for (let c = col; c < col + cols; c++) {
                if (c >= this.gridCols) return false;
                if (this.grid[r][c].occupied) return false;
            }
        }
        return true;
    }

    private markOccupied(col: number, row: number, cols: number, rows: number, articleId: string): void {
        this.expandGridIfNeeded(row + rows);

        for (let r = row; r < row + rows; r++) {
            for (let c = col; c < col + cols; c++) {
                this.grid[r][c] = { occupied: true, articleId };
            }
        }
        this.nextRow = Math.max(this.nextRow, row + rows);
    }

    // Place an article in the grid
    placeArticle(article: ArticleWithSize, minRow: number = 0): PlacedArticle | null {
        const pos = this.findPosition(article.cols, article.rows, minRow);
        if (!pos) return null;

        this.markOccupied(pos.col, pos.row, article.cols, article.rows, article.id);
        const placement = { article, ...pos };
        this.placements.push(placement);
        return placement;
    }

    // Detect gaps (empty rectangular regions)
    detectGaps(minArea: number = 6): Gap[] {
        const gaps: Gap[] = [];
        const visited = new Set<string>();

        for (let r = 0; r < this.nextRow; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const key = `${c},${r}`;
                if (visited.has(key) || this.grid[r][c].occupied) continue;

                // Find largest rectangle starting from this cell
                const gap = this.findLargestGap(c, r, visited);
                if (gap && gap.area >= minArea) {
                    gaps.push(gap);
                }
            }
        }

        return gaps.sort((a, b) => b.area - a.area); // Largest first
    }

    private findLargestGap(startCol: number, startRow: number, visited: Set<string>): Gap | null {
        // Find max width
        let maxWidth = 0;
        for (let c = startCol; c < this.gridCols; c++) {
            if (this.grid[startRow][c].occupied) break;
            maxWidth++;
        }

        // Find max height maintaining width
        let maxHeight = 0;
        let currentWidth = maxWidth;

        for (let r = startRow; r < this.nextRow; r++) {
            let rowWidth = 0;
            for (let c = startCol; c < startCol + currentWidth; c++) {
                if (this.grid[r][c].occupied) break;
                rowWidth++;
            }
            if (rowWidth === 0) break;
            currentWidth = Math.min(currentWidth, rowWidth);
            maxHeight++;
        }

        // Mark visited
        for (let r = startRow; r < startRow + maxHeight; r++) {
            for (let c = startCol; c < startCol + currentWidth; c++) {
                visited.add(`${c},${r}`);
            }
        }

        return {
            col: startCol,
            row: startRow,
            width: currentWidth,
            height: maxHeight,
            area: currentWidth * maxHeight
        };
    }

    // Find best article to fill a gap (ZS score priority)
    findFillerForGap(gap: Gap, candidates: ArticleWithSize[]): ArticleWithSize | null {
        // Filter articles that fit in the gap
        const fittingArticles = candidates.filter(a =>
            a.cols <= gap.width && a.rows <= gap.height
        );

        if (fittingArticles.length === 0) return null;

        // Sort by ZS score (lower is better), then by how well it fills the gap
        fittingArticles.sort((a, b) => {
            // Primary: ZS score (ascending - lower is better quality)
            const zsDiff = a.zeroEchoScore - b.zeroEchoScore;
            if (Math.abs(zsDiff) > 0.5) return zsDiff;

            // Secondary: Fill efficiency (prefer articles that fill more of the gap)
            const fillA = (a.cols * a.rows) / gap.area;
            const fillB = (b.cols * b.rows) / gap.area;
            return fillB - fillA;
        });

        return fittingArticles[0] || null;
    }

    // Main optimization function
    optimizeLayout(articles: any[]): any[] {
        // Reset grid completely
        this.gridRows = 100;
        this.grid = this.createEmptyGrid(this.gridCols, this.gridRows);
        this.placements = [];
        this.nextRow = 0;

        // Calculate sizes for all articles
        // IMPORTANT: Use url as ID since articles may not have a dedicated 'id' field
        const articlesWithSize: ArticleWithSize[] = articles.map((a, index) => ({
            ...a,
            id: a.id || a.url || `article-${index}`, // Fallback to url or index
            ...calculateArticleSize(a),
            zeroEchoScore: a.zero_echo_score || 0,
            impactScore: a.impact_score || 0
        }));

        // Sort by Combined Score (primary placement order)
        const sortedArticles = [...articlesWithSize].sort((a, b) => {
            const combinedA = (10 - a.zeroEchoScore) + a.impactScore;
            const combinedB = (10 - b.zeroEchoScore) + b.impactScore;
            return combinedB - combinedA;
        });

        const placed = new Set<string>();
        const finalOrder: ArticleWithSize[] = [];

        // ===== AWARD SYSTEM =====
        // 1. Today's Headline: Best Combined Score (10 - ZS) + IS
        // 2. Zero Noise Award: Lowest ZS (tiebreaker: highest IS)
        // 3. Hot Topic: Highest IS

        // Find award winners
        const byCombo = [...articlesWithSize].sort((a, b) => {
            const combinedA = (10 - a.zeroEchoScore) + a.impactScore;
            const combinedB = (10 - b.zeroEchoScore) + b.impactScore;
            return combinedB - combinedA;
        });

        const byZS = [...articlesWithSize].sort((a, b) => {
            const zsDiff = a.zeroEchoScore - b.zeroEchoScore; // Lower is better
            if (Math.abs(zsDiff) < 0.01) {
                return b.impactScore - a.impactScore; // Tiebreaker: higher IS
            }
            return zsDiff;
        });

        const byIS = [...articlesWithSize].sort((a, b) => b.impactScore - a.impactScore);

        // Assign awards (an article can win multiple)
        const awardMap = new Map<string, string[]>();

        const addAward = (articleId: string, award: string) => {
            if (!awardMap.has(articleId)) {
                awardMap.set(articleId, []);
            }
            awardMap.get(articleId)!.push(award);
        };

        // Assign primary awards
        if (byCombo.length > 0) addAward(byCombo[0].id, "Today's Headline");
        if (byZS.length > 0) addAward(byZS[0].id, "Zero Noise Award");
        if (byIS.length > 0) addAward(byIS[0].id, "Hot Topic");

        // Build Top 3 list (unique articles with awards)
        const top3Ids: string[] = [];
        const usedForTop3 = new Set<string>();

        // Helper to get next unused winner for a category
        const getNextWinner = (sortedList: ArticleWithSize[]): ArticleWithSize | null => {
            for (const article of sortedList) {
                if (!usedForTop3.has(article.id)) {
                    return article;
                }
            }
            return null;
        };

        // Slot 1: Today's Headline winner (or runner-up if already used)
        const headlineWinner = getNextWinner(byCombo);
        if (headlineWinner) {
            top3Ids.push(headlineWinner.id);
            usedForTop3.add(headlineWinner.id);
        }

        // Slot 2: Zero Noise Award winner (or runner-up if already used)
        const zeroNoiseWinner = getNextWinner(byZS);
        if (zeroNoiseWinner) {
            top3Ids.push(zeroNoiseWinner.id);
            usedForTop3.add(zeroNoiseWinner.id);
        }

        // Slot 3: Hot Topic winner (or runner-up if already used)
        const hotTopicWinner = getNextWinner(byIS);
        if (hotTopicWinner) {
            top3Ids.push(hotTopicWinner.id);
            usedForTop3.add(hotTopicWinner.id);
        }

        console.log(`[Awards] Today's Headline: ${headlineWinner?.id?.substring(0, 30)}`);
        console.log(`[Awards] Zero Noise Award: ${zeroNoiseWinner?.id?.substring(0, 30)}`);
        console.log(`[Awards] Hot Topic: ${hotTopicWinner?.id?.substring(0, 30)}`);

        // Phase 0: Place Top 3 Award Winners
        let lastPlacedRow = 0;

        for (let i = 0; i < top3Ids.length; i++) {
            const article = articlesWithSize.find(a => a.id === top3Ids[i]);
            if (!article) continue;

            // Attach awards to article
            article.awards = awardMap.get(article.id) || [];

            // First article (Headline) gets full width
            if (i === 0) {
                article.cols = 10;
            }

            const p = this.placeArticle(article, lastPlacedRow);
            if (p) {
                placed.add(article.id);
                finalOrder.push(article);
                if (i === 0) {
                    lastPlacedRow = p.row + p.article.rows;
                } else {
                    lastPlacedRow = p.row;
                }
            }
        }

        console.log(`[Phase 0] After Top 3: finalOrder=${finalOrder.length}, placed=${placed.size}`);

        // Phase 1: Place remaining primary articles (greedy)
        const primaryCount = Math.ceil(sortedArticles.length * 0.7); // 70% are primary
        for (let i = 0; i < sortedArticles.length; i++) {
            const article = sortedArticles[i];
            if (placed.has(article.id)) continue;

            const p = this.placeArticle(article);
            if (p) {
                placed.add(article.id);
                finalOrder.push(article);
            }
        }

        // Phase 2: Detect gaps and fill with remaining articles (ZS priority)
        const remainingArticles = sortedArticles.filter(a => !placed.has(a.id));

        // Multiple passes to fill gaps
        for (let pass = 0; pass < 3; pass++) {
            const gaps = this.detectGaps(6);

            for (const gap of gaps) {
                const candidates = remainingArticles.filter(a => !placed.has(a.id));
                const filler = this.findFillerForGap(gap, candidates);

                if (filler) {
                    // Place at gap position
                    if (this.canPlace(gap.col, gap.row, filler.cols, filler.rows)) {
                        this.markOccupied(gap.col, gap.row, filler.cols, filler.rows, filler.id);
                        placed.add(filler.id);
                        finalOrder.push(filler);
                    }
                }
            }
        }

        // Phase 3: Append any remaining articles
        for (const article of remainingArticles) {
            if (!placed.has(article.id)) {
                this.placeArticle(article);
                placed.add(article.id);
                finalOrder.push(article);
            }
        }

        console.log(`[LayoutOptimizer] Input: ${articles.length}, Output: ${finalOrder.length}`);
        return finalOrder;
    }

    // Get debug info about current grid state
    getGridStats(): { occupiedCells: number; totalCells: number; fillRate: number } {
        let occupiedCells = 0;
        const totalCells = this.nextRow * this.gridCols;

        for (let r = 0; r < this.nextRow; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (this.grid[r][c].occupied) occupiedCells++;
            }
        }

        return {
            occupiedCells,
            totalCells,
            fillRate: totalCells > 0 ? occupiedCells / totalCells : 0
        };
    }
}

// Singleton instance for convenience
let optimizerInstance: LayoutOptimizer | null = null;

export const getLayoutOptimizer = (cols: number = 10): LayoutOptimizer => {
    if (!optimizerInstance) {
        optimizerInstance = new LayoutOptimizer(cols);
    }
    return optimizerInstance;
};

export const optimizeArticleOrder = (articles: any[]): any[] => {
    const optimizer = new LayoutOptimizer(10);
    return optimizer.optimizeLayout(articles);
};
