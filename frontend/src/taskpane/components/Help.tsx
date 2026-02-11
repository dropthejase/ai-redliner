import * as React from "react";

const Help: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <div className="flex flex-col gap-6 p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Getting Started</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Redliner is an AI-powered document assistant that helps you review and edit Word documents using natural language.
          </p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">1. Start a conversation</strong> — Type a message like "Review this document for legal clarity" or "Change all instances of 'Company' to 'Organization'"</p>
            <p><strong className="text-foreground">2. Review proposed changes</strong> — The agent streams its response and shows proposed edits in an expandable panel below</p>
            <p><strong className="text-foreground">3. Select and apply</strong> — Check the changes you want, optionally edit the new text, then click Apply</p>
            <p><strong className="text-foreground">4. See redlines in Word</strong> — Approved changes appear as tracked changes (redlines) in your document</p>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">What the Agent Can Do</h2>
          <p className="text-sm text-muted-foreground">
            See the <a href="https://github.com/dropthejase/ai-redliner/tree/main/frontend/src/taskpane/microsoft-actions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub repository</a> for full documentation.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Example Prompts</h2>
          <div className="space-y-2">
            <div className="text-sm bg-card border border-border px-3 py-2 rounded-lg text-muted-foreground">
              "Make the title bold and change 'Draft' to 'Final'"
            </div>
            <div className="text-sm bg-card border border-border px-3 py-2 rounded-lg text-muted-foreground">
              "Review this contract for vague terms and highlight them"
            </div>
            <div className="text-sm bg-card border border-border px-3 py-2 rounded-lg text-muted-foreground">
              "Update all dates from 2024 to 2025"
            </div>
            <div className="text-sm bg-card border border-border px-3 py-2 rounded-lg text-muted-foreground">
              "Delete the second paragraph and add a new one saying..."
            </div>
            <div className="text-sm bg-card border border-border px-3 py-2 rounded-lg text-muted-foreground">
              "Add a row to the table with: Q4, $200,000"
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Sessions & History</h2>
          <p className="text-sm text-muted-foreground">
            Your conversations are automatically saved. Switch to the <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">History</span> tab to view past sessions, see proposed changes, or continue where you left off.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Settings</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Switch to the <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">Settings</span> tab to configure:
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• <strong className="text-foreground">Model selection</strong> — choose between Claude, GPT, Gemini, or other models</p>
            <p>• <strong className="text-foreground">Auto-approve tools</strong> — toggle automatic approval for agent actions</p>
            <p>• <strong className="text-foreground">MCP servers</strong> — view and manage external tool integrations (AWS docs, filesystem, web search, etc.)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
