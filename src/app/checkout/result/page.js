'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ResultContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    const isSuccess = status === 'success';

    return (
        <div className="page">
            <div className="container">
                <div className="result-container">
                    <div className="result-card card">
                        <div className="result-icon">
                            {isSuccess ? '✅' : '❌'}
                        </div>
                        <h2>{isSuccess ? 'Abonelik Oluşturuldu!' : 'Bir Sorun Oluştu'}</h2>
                        <p>{message || (isSuccess ? 'Aboneliğiniz başarıyla başlatıldı.' : 'Ödeme işlemi başarısız oldu.')}</p>

                        {isSuccess ? (
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Link href="/checkout" className="btn btn-secondary">
                                    🔄 Yeni Abonelik
                                </Link>
                            </div>
                        ) : (
                            <Link href="/checkout" className="btn btn-primary">
                                🔄 Tekrar Dene
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        }>
            <ResultContent />
        </Suspense>
    );
}
