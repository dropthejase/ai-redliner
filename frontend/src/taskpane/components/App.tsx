import * as React from "react";
import ChatInterface from "./ChatInterface";

const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Redliner</h1>
        <p className="text-xs text-muted-foreground mt-0.5">AI-powered document assistant</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 gap-3">
        <ChatInterface />
      </div>
    </div>
  );
};

export default App;
