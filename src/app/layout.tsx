"use client";
import { ThirdwebProvider } from "thirdweb/react";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <title>Founders Inc FIFA Tracker</title>
        <meta name="description" content="Track your FIFA match results and rankings" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/founders-logo.svg" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        <ThirdwebProvider>
          <div className="min-h-screen fi-bg">
            <Navbar />
            <div className="container mx-auto px-4 py-8 relative z-10">
              {children}
            </div>
            <footer className="border-t border-white/10 text-white/60 p-4 text-center text-sm relative z-10">
              <p>© {new Date().getFullYear()} Founders Inc FIFA Tracker | Built for football fans</p>
            </footer>
          </div>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
