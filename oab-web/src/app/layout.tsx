import type { Metadata } from "next";
import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";

const display = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Empowering Bladder Health",
  description: "Helping you make decisions about treatment for overactive bladder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${inter.variable} bg-[#02052e]`}>
      <body className="min-h-screen font-sans bg-[#02052e] text-[#faf5d9] antialiased">
        {children}
      </body>
    </html>
  );
}
