'use client';

import Script from 'next/script';
import { useState, useEffect } from 'react';

export function Providers({ children }) {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const host = params.get('host');
        const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

        if (host && apiKey) {
            setConfig({
                apiKey: apiKey,
                host: host,
                forceRedirect: true
            });
            // Host varsa App Bridge yuklendiginde otomatik auth yapalim
            sessionStorage.setItem('admin_auth', 'true');
        }
    }, []);

    return (
        <>
            {/* 
            {config && (
                <Script 
                    src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
                    data-api-key={config.apiKey}
                />
            )}
            */}
            {children}
        </>
    );
}
