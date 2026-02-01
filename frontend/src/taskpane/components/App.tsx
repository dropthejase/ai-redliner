import * as React from "react";
import ChatInterface from "./ChatInterface";

const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen p-4 gap-3 bg-background">
      <h1 className="text-base font-semibold text-foreground border-b border-border pb-2">
        Redliner Assistant
      </h1>
      <ChatInterface />
    </div>
  );
};

export default App;
