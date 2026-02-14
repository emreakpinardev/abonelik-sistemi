import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "Abonelik Yönetimi - iyzico + Shopify",
  description: "Shopify mağazanız için iyzico tabanlı abonelik yönetim sistemi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
