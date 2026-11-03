import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'HeritageVerse | Explore Ancient Anuradhapura',description:'Explore the heritage of Anuradhapura with an interactive map and illustrative 3D viewer.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body suppressHydrationWarning>{children}</body></html>}
