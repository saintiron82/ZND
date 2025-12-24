export const LAYOUT_CONFIG = {
    grid: {
        totalColumns: 10,      // md:grid-cols-10
        cellHeight: 10,        // High Resolution Grid (10px steps) for minimal waste
        gap: 4,               // gap-4 (Tailwind unit)
    },
    // Content Weight Factors for Volume Calculation
    // Volume = (Score * scoreWeight)
    volumeFactors: {
        scoreWeight: 3.0,      // Impact Score acts as the ONLY multiplier (increased to compensate for text removal)
        textWeight: 0.0,       // REMOVED: Text length no longer affects volume
    },
    // Grid Constraints
    constraints: {
        minWidth: 3,           // Allow narrow 3-col "tower" cards for variety
        maxWidth: 8,
        minHeight: 2,          // Relaxed to 2 for Wide cards (Smart constraint in component)
    },
    // Shape Efficiency: Adjusts height based on text wrapping efficiency
    // Narrow cards wrap more (Inefficient) -> Need more height (Divide by < 1.0)
    // Wide cards wrap less (Efficient) -> Need less height (Divide by > 1.0)
    shapeEfficiency: {
        narrowThreshold: 3,    // Cols <= 3
        narrowFactor: 0.9,     // Inefficient: Increases Height

        wideThreshold: 6,      // Cols >= 6
        wideFactor: 1.1,       // Efficient: Decreases Height

        standardFactor: 1.0,
    },
    // Physics Constants for Exact Text Fit
    physics: {
        colWidthPx: 116,       // Approx 1 column width in pixels (Desktop 1200px / 10 cols)
        lineHeightPx: 24,      // Relaxed line height
        charWidthPx: 13,       // Increased from 11 to 13 to account for 'break-keep' wrapping overhead
        paddingPx: 40,         // Horizontal padding (p-5 = 20px * 2)
        headerHeightPx: 130,   // Increased from 100 to 130 to accommodate multi-line titles
    },
    // Content display rules (Line Clamping)
    corrections: {
        lineClamp: [
            { minRatio: 2.0, minRows: 0, lines: 8 },  // Ultra Wide
            { minRatio: 1.4, minRows: 3, lines: 6 },  // Wide & Tall
            { minRatio: 1.0, minRows: 0, lines: 5 },  // Square/Balanced
            { minRatio: 0.0, minRows: 4, lines: 5 },  // Tall Tower
            { minRatio: 0.0, minRows: 0, lines: 3 },  // Default Narrow
        ]
    }
};
