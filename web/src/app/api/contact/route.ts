import { NextRequest, NextResponse } from 'next/server';

// [CAUTION] 회사 네트워크/프록시 환경의 SSL 인증서 문제(self-signed certificate) 해결을 위해 검증 비활성화
// 이 설정은 런타임에 적용되어 배포 환경에서도 fetch가 정상 작동하도록 함
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Discord Webhook을 통해 Contact 메시지를 전송하는 API
 * POST /api/contact
 */
export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json();

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json(
                { error: '메시지를 입력해주세요.' },
                { status: 400 }
            );
        }

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error('[Contact API] DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
            return NextResponse.json(
                { error: '서버 설정 오류' },
                { status: 500 }
            );
        }

        // Discord Webhook으로 메시지 전송
        const discordPayload = {
            embeds: [
                {
                    title: '📬 ZED 웹사이트 새 문의',
                    description: message.trim(),
                    color: 0x14b8a6, // teal-500 색상
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'ZED Contact Form',
                    },
                },
            ],
        };

        const discordResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(discordPayload),
        });

        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            console.error('[Contact API] Discord 전송 실패:', errorText);
            return NextResponse.json(
                { error: 'Discord 전송 실패' },
                { status: 500 }
            );
        }

        console.log('[Contact API] 메시지 전송 성공');
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Contact API] 오류:', error);
        return NextResponse.json(
            { error: '서버 오류' },
            { status: 500 }
        );
    }
}
