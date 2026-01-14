import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://znd.news';

    // 현재는 정적 라우트만 존재하므로 하드코딩된 리스트 반환
    // 향후 동적 라우트(예: /article/[id]) 추가 시 API 연동하여 생성
    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/reports`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9, // Reports 페이지 중요도 강조
        },
    ];
}
