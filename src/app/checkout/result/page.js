'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ResultContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const [countdown, setCountdown] = useState(5);

    const isSuccess = status === 'success';
    const shopUrl = 'https://skycrops-store.myshopify.com';

    useEffect(() => {
        if (isSuccess) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.href = shopUrl;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isSuccess]);

    return (
        <>
            <style>{css}</style>
            <div className="result-page">
                <div className="result-container">
                    <div className={`result-card ${isSuccess ? 'success' : 'error'}`}>
                        <div className="result-icon-wrap">
                            <span className="material-symbols-rounded result-icon">
                                {isSuccess ? 'check_circle' : 'error'}
                            </span>
                        </div>
                        <h2>{isSuccess ? 'Ödemeniz Başarılı!' : 'Bir Sorun Oluştu'}</h2>
                        <p className="result-msg">{message || (isSuccess ? 'Siparişiniz başarıyla oluşturuldu.' : 'Ödeme işlemi başarısız oldu.')}</p>

                        {isSuccess ? (
                            <div className="result-redirect">
                                <p className="result-countdown">{countdown} saniye içinde siteye yönlendiriliyorsunuz...</p>
                                <div className="result-progress">
                                    <div className="result-progress-bar" style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
                                </div>
                                <a href={shopUrl} className="result-btn success">
                                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>storefront</span>
                                    Siteye Dön
                                </a>
                            </div>
                        ) : (
                            <div className="result-actions">
                                <a href={shopUrl} className="result-btn error">
                                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
                                    Siteye Dön
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function ResultPage() {
    return (
        <Suspense
            fallback={
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f7f7f8' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid #eee', borderTopColor: '#1a1a2e', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
            }
        >
            <ResultContent />
        </Suspense>
    );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
* { margin: 0; padding: 0; box-sizing: border-box; }

@keyframes spin { to { transform: rotate(360deg); } }

.result-page {
    min-height: 100vh;
    background: #f7f7f8;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.result-container { max-width: 460px; width: 100%; }

.result-card {
    background: #fff;
    border-radius: 16px;
    padding: 48px 40px;
    text-align: center;
    border: 1px solid #e8e8ec;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
}

.result-icon-wrap { margin-bottom: 20px; }

.result-icon { font-size: 64px !important; }
.result-card.success .result-icon { color: #4caf50; }
.result-card.error .result-icon { color: #e53935; }

.result-card h2 { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.result-msg { font-size: 15px; color: #888; line-height: 1.5; margin-bottom: 28px; }

.result-redirect { display: flex; flex-direction: column; gap: 16px; }
.result-countdown { font-size: 13px; color: #999; }

.result-progress { width: 100%; height: 4px; background: #eee; border-radius: 4px; overflow: hidden; }
.result-progress-bar { height: 100%; background: #4caf50; border-radius: 4px; transition: width 1s linear; }

.result-actions { display: flex; justify-content: center; }

.result-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    text-decoration: none;
    transition: all 0.2s;
}
.result-btn.success { background: #1a1a2e; color: #fff; }
.result-btn.success:hover { background: #2d2d4e; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26,26,46,0.2); }
.result-btn.error { background: #f0f0f3; color: #1a1a2e; border: 1.5px solid #ddd; }
.result-btn.error:hover { background: #e8e8ec; }
`;
