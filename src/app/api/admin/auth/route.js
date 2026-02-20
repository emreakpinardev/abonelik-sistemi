import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD || 'skycrops2024';

        if (password === adminPassword) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: 'Yanlis sifre' }, { status: 401 });
        }
    } catch (err) {
        return NextResponse.json({ success: false, error: 'Hata' }, { status: 500 });
    }
}
