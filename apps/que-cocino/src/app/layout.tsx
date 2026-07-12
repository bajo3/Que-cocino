import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = { title: { default: "Qué Cocino", template: "%s · Qué Cocino" }, description: "Recetas basadas en lo que realmente tenés en casa.", manifest: "/manifest.webmanifest" };
export const viewport = { themeColor: "#3b7d4b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}><body className="font-sans antialiased"><Toaster richColors position="top-center" />{children}</body></html>;
}
