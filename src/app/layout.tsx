import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: "Colégio São José — Gestão de Chaves",
    description: "Sistema Institucional de Gestão de Chaves do Colégio São José",
    icons: {
        icon: '/logo/logo.png',
        apple: '/logo/logo.png',
    },
    manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" className={inter.variable}>
            <body>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#1a2d4f',
                            color: '#f0f4ff',
                            border: '1px solid rgba(212,170,66,0.25)',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.875rem',
                        },
                        success: { iconTheme: { primary: '#4ade80', secondary: '#1a2d4f' } },
                        error: { iconTheme: { primary: '#f87171', secondary: '#1a2d4f' } },
                    }}
                />
            </body>
        </html>
    );
}
