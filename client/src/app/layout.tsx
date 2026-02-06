import { Inter } from "next/font/google";
import type React from "react";
import "./globals.css";
import { Header } from "@/components/ui/Header";
import { metadata } from "./metadata";

export { metadata };

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-green-900 text-white min-h-screen`}>
        <div className="min-h-screen flex flex-col">
          <Header />

          {/* Main content */}
          <main className="flex-grow container mx-auto p-4">
            {children}
          </main>
          
          {/* Footer */}
          <footer className="bg-green-800 border-t border-green-700 p-4 text-center text-green-300">
            <p>Play-money poker platform for demonstration purposes only</p>
            <p className="text-sm mt-1">Not intended for real-money gambling</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
