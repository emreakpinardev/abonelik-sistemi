import "./globals.css";

export const metadata = {
  title: "Abonelik Yönetimi - iyzico + Shopify",
  description: "Shopify mağazanız için iyzico tabanlı abonelik yönetim sistemi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
