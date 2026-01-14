import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://znd.news'; // Production Domain

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/'], // API 경로는 크롤링 제외
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
