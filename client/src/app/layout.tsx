import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";

const ConnectionStatus = dynamic(
  () => import("@/components/ui/ConnectionStatus"),
  { ssr: false }
);

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Turnbasedgame Poker",
  description: "Real-time two-player Texas Hold'em poker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-green-900 text-white min-h-screen`}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-green-800 border-b border-green-700 p-4">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-red-500 rounded-full"></div>
                <h1 className="text-2xl font-bold">Turnbasedgame Poker</h1>
              </div>
              <ConnectionStatus />
            </div>
          </header>
          
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
