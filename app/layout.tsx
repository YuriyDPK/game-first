import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Northbound — битва за земли', description: 'Собирай ресурсы, строй поселение и веди армию к победе.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ru"><body>{children}</body></html>}
