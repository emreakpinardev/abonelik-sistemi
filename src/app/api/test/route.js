import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ ok: true, method: 'GET', time: new Date().toISOString() });
}

export async function POST(request) {
    let body = null;
    try {
        body = await request.json();
    } catch (e) {
        // no body
    }
    return NextResponse.json({ ok: true, method: 'POST', body, time: new Date().toISOString() });
}
