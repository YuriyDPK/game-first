import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: 'Богатыри — Земля русская',
 description: 'Три легенды. Одна земля. Мультиплеерная 3D-арена на Руси: Илья Муромец, Добрыня Никитич и Алёша Попович. Выбери богатыря и вступи в бой.',
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
