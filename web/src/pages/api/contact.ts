
import type { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';

// SSL 인증서 검증 우회 (회사 네트워크/프록시 환경 대응)
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

type Data = {
    success?: boolean;
    error?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error('[Contact API] DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
            return res.status(500).json({ error: '서버 설정 오류' });
        }

        const discordPayload = {
            embeds: [
                {
                    title: '📬 ZED 웹사이트 새 문의',
                    description: message.trim(),
                    color: 0x14b8a6,
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
            return res.status(500).json({ error: 'Discord 전송 실패' });
        }

        // 성공
        console.log('[Contact API] 메시지 전송 성공');
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[Contact API] 오류:', error);
        return res.status(500).json({ error: '서버 오류' });
    }
}
