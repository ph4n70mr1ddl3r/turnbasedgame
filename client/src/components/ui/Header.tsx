import dynamic from "next/dynamic";

const ConnectionStatus = dynamic(
  () => import("@/components/ui/ConnectionStatus").then(mod => mod.ConnectionStatus)
);

export function Header() {
  return (
    <header className="bg-green-800 border-b border-green-700 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-500 rounded-full"></div>
          <h1 className="text-2xl font-bold">Turnbasedgame Poker</h1>
        </div>
        <ConnectionStatus />
      </div>
    </header>
  );
}
