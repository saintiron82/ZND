import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import VisitorTracker from "@/components/VisitorTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | ZND',
    default: 'ZeroEcho.Daily - AI가 분석한 오늘의 글로벌 뉴스',
  },
  description: 'AI가 엄선하고 분석한 글로벌 테크 트렌드와 인사이트. 노이즈 없는 핵심 뉴스(Signal)만 전달합니다.',
  keywords: ['뉴스', 'AI', '인공지능', '테크', '트렌드', '기술', 'IT', '글로벌 뉴스', 'ZeroEcho'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://znd.news',
    siteName: 'ZeroEcho.Daily',
    title: 'ZeroEcho.Daily - AI Global News Analysis',
    description: 'AI가 분석한 글로벌 테크 인사이트. 핵심만 빠르게 확인하세요.',
    images: [
      {
        url: '/logo.png', // public 폴더의 로고 사용 (권장: 1200x630 사이즈의 og-image.png 제작 필요)
        width: 1200,
        height: 630,
        alt: 'ZeroEcho.Daily Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZeroEcho.Daily - AI 뉴스 분석',
    description: 'AI가 엄선한 글로벌 테크 트렌드.',
    // images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <VisitorTracker />
        {children}
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
