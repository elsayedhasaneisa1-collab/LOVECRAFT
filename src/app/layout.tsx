import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata:Metadata={title:'LOVECRAFT BOT — Your Moments. Your Website.',description:'استوديو القوالب التفاعلية. اختر تصميمًا، أضف لمستك، وشارك موقعًا مستقلًا يحكي لحظتك.'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#873b49'};
export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="ar" dir="rtl" className="scroll-smooth"><head><link rel="preload" as="font" href="/fonts/cairo-arabic.woff2" type="font/woff2" crossOrigin="anonymous"/><link rel="stylesheet" href="/fonts/studio-fonts.css"/></head><body className="min-h-screen w-full max-w-full overflow-x-clip bg-[#08070d] text-zinc-100 antialiased">{children}</body></html>;
}
