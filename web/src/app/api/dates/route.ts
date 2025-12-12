
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // 항상 동적으로 실행 (캐시 방지)

export async function GET() {
    try {
        const dataDir = path.join(process.cwd(), '..', 'supplier', 'data');

        try {
            await fs.access(dataDir);
        } catch {
            return NextResponse.json({ dates: [], latest: null }, { status: 200 });
        }

        const entries = await fs.readdir(dataDir, { withFileTypes: true });

        // 날짜 형식(YYYY-MM-DD) 폴더만 필터링
        const dates = entries
            .filter(dirent => dirent.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dirent.name))
            .map(dirent => dirent.name)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // 최신순 정렬

        return NextResponse.json({
            dates: dates,
            latest: dates.length > 0 ? dates[0] : null
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
