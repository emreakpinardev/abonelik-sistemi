import { redirect } from 'next/navigation';

export default function Home() {
  // Ana sayfa dogrudan erisilemez — sadece API olarak kullanilir
  redirect('https://skycrops-store.myshopify.com');
}
