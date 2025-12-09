import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message } = body;

        if (!message || message.trim() === '') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // TODO: Implement actual email sending logic here (e.g., using Nodemailer or an email service API)
        // For now, we log the message to the server console to simulate receiving it securely.
        console.log('--- NEW CONTACT MESSAGE RECEIVED ---');
        console.log('Message:', message);
        console.log('------------------------------------');

        return NextResponse.json({ success: true, message: 'Message received' });
    } catch (error) {
        console.error('Error processing contact request:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
