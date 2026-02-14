import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'shopify-buttons.js');
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abonelik-sistemi.vercel.app';
        const scriptContent = fileContent.replace('{{APP_URL}}', appUrl);

        return new NextResponse(scriptContent, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        console.error('Script serving error:', error);
        return new NextResponse('console.error("Script not found");', {
            status: 404,
            headers: { 'Content-Type': 'application/javascript' }
        });
    }
}
