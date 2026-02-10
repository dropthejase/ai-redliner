/* global Word console */

import * as React from "react";

const TestPanel: React.FC = () => {
  const [status, setStatus] = React.useState<string>("");

  const testParagraphDelete = async () => {
    setStatus("Running Paragraph.delete()...");

    try {
      await Word.run(async (context: Word.RequestContext) => {
        context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items");
        await context.sync();

        const paragraph = paragraphs.items[12];
        paragraph.delete();
        await context.sync();

        context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
        await context.sync();

        setStatus("✓ Paragraph.delete() completed");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`✗ Paragraph.delete() failed: ${message}`);
      console.error("Test error:", error);
    }
  };

  const testParagraphAppend = async () => {
    setStatus("Running Paragraph.insertText(end)...");

    try {
      await Word.run(async (context: Word.RequestContext) => {
        context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items");
        await context.sync();

        const paragraph = paragraphs.items[12];
        paragraph.insertText("\nAppended via Paragraph.insertText(end)", Word.InsertLocation.end);
        await context.sync();

        context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
        await context.sync();

        setStatus("✓ Paragraph.insertText(end) completed");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`✗ Paragraph.insertText(end) failed: ${message}`);
      console.error("Test error:", error);
    }
  };

  const testParagraphReplace = async () => {
    setStatus("Running Paragraph.insertText(replace)...");

    try {
      await Word.run(async (context: Word.RequestContext) => {
        context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items");
        await context.sync();

        const paragraph = paragraphs.items[12];
        paragraph.insertText("Replaced via Paragraph.insertText(replace)", Word.InsertLocation.replace);
        await context.sync();

        context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
        await context.sync();

        setStatus("✓ Paragraph.insertText(replace) completed");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`✗ Paragraph.insertText(replace) failed: ${message}`);
      console.error("Test error:", error);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Test Paragraph Object Methods</h2>

      <div className="text-xs text-muted-foreground leading-relaxed">
        These buttons test using <strong>Paragraph object methods</strong> directly (not Range).
        Make sure your document has at least 13 paragraphs, with p12 containing: <span className="font-mono">"The rabbit [action]."</span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={testParagraphDelete}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:opacity-90 text-sm"
        >
          Test Delete (Paragraph.delete)
        </button>

        <button
          onClick={testParagraphAppend}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 text-sm"
        >
          Test Append (Paragraph.insertText end)
        </button>

        <button
          onClick={testParagraphReplace}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 text-sm"
        >
          Test Replace (Paragraph.insertText replace)
        </button>
      </div>

      {status && (
        <div className="p-3 bg-muted text-muted-foreground text-xs rounded font-mono">
          {status}
        </div>
      )}

      <div className="text-xs text-muted-foreground leading-relaxed">
        <strong>Testing:</strong> Direct Paragraph object methods to see how they behave vs Range methods.
        If successful, we'll update resolveLocation() to return Paragraph when withinPara is empty.
      </div>
    </div>
  );
};

export default TestPanel;
