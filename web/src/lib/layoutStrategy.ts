export const getGridClass = (index: number) => {
    // Pattern repeats every 5 items (just an example pattern)
    const patternIndex = index % 5;

    // Mobile: always col-span-1 (full width in 1-col grid)
    // Desktop: 10-col grid

    switch (patternIndex) {
        case 0: // Big Lead (Left)
            return "md:col-span-6 md:row-span-2";
        case 1: // Top Right
            return "md:col-span-4 md:row-span-1";
        case 2: // Bottom Right
            return "md:col-span-4 md:row-span-1";
        case 3: // Wide Bottom
            return "md:col-span-7 md:row-span-1";
        case 4: // Small Bottom
            return "md:col-span-3 md:row-span-1";
        default:
            return "md:col-span-5 md:row-span-1";
    }
};
