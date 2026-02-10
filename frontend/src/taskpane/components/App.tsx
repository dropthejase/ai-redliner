import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "../lib/utils";
import ChatInterface from "./ChatInterface";
import HistoryList from "./HistoryList";
import Settings, { getStoredModel, setStoredModel, ModelId } from "./Settings";
import Help from "./Help";

type Page = "chat" | "history" | "settings" | "help";

const TABS: { key: Page; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
  { key: "help", label: "Help" },
];

const App: React.FC = () => {
  const [page, setPage] = React.useState<Page>("chat");
  const [selectedModel, setSelectedModel] = React.useState<ModelId>(getStoredModel);
  const [sessionId, setSessionId] = React.useState<string>(() => crypto.randomUUID());
  const [showApiWarning, setShowApiWarning] = React.useState(false);

  // Check WordApiDesktop 1.4 support on mount by trying to set Simple Markup mode
  React.useEffect(() => {
    const checkApiSupport = async () => {
      try {
        await Word.run(async (context: Word.RequestContext) => {
          const revisionsFilter = context.document.activeWindow.view.revisionsFilter;
          revisionsFilter.set({ markup: "Simple" });
          await context.sync();
        });
        // If we got here, the API is supported
      } catch (error) {
        // API not supported - show warning
        setShowApiWarning(true);
      }
    };

    checkApiSupport();
  }, []);

  const handleModelChange = (id: ModelId) => {
    setStoredModel(id);
    setSelectedModel(id);
  };

  const handleContinueSession = (id: string) => {
    setSessionId(id);
    setPage("chat");
  };

  const handleNewSession = () => {
    setSessionId(crypto.randomUUID());
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* API Warning Modal */}
      {showApiWarning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 mx-4 shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  WordApiDesktop 1.4 Not Supported
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  WordApiDesktop 1.4 is not supported on this device.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Please upgrade your Microsoft Word to at least <strong>Version 2508 (Build 19127.20264)</strong> for best results.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If this is not possible, set <strong>Mark-up Options</strong> to <strong>Show Revisions in Balloons</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowApiWarning(false)}
                className="text-xs px-4 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Redliner</h1>
        <p className="text-xs text-muted-foreground mt-0.5">AI-powered document assistant</p>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex gap-1 px-4 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPage(tab.key)}
            className={cn(
              "text-xs font-medium px-3 py-1 rounded-full transition-colors",
              page === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-card-foreground/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-4 pb-4 gap-3">
        {page === "chat" && <ChatInterface selectedModel={selectedModel} sessionId={sessionId} onNewSession={handleNewSession} />}
        {page === "history" && <HistoryList onContinue={handleContinueSession} />}
        {page === "settings" && <Settings selectedModel={selectedModel} onModelChange={handleModelChange} />}
        {page === "help" && <Help />}
      </div>
    </div>
  );
};

export default App;
