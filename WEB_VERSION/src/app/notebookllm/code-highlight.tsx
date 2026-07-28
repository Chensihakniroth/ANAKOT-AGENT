// CodeHighlight — shiki-based syntax highlighting for NotebookLLM source preview
import { useEffect, useState } from "react";

const LANG_MAP: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".html": "html",
  ".css": "css",
  ".json": "json",
  ".md": "markdown",
  ".csv": "plaintext",
  ".log": "plaintext",
  ".txt": "plaintext",
};

export function CodeHighlight({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const ext = "." + filename.split(".").pop()?.toLowerCase();
    const lang = LANG_MAP[ext] || "plaintext";

    (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const result = await codeToHtml(code, {
          lang,
          theme: "github-dark-default",
        });
        if (!cancelled) setHtml(result);
      } catch {
        // Fallback: plain monospace
        if (!cancelled) setHtml("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, filename]);

  if (html) {
    return (
      <div
        className="max-h-96 overflow-y-auto rounded border border-(--ui-stroke-secondary) text-[11px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Fallback: plain monospace
  return (
    <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) p-3 font-mono text-[11px] leading-relaxed text-(--ui-text-secondary)">
      {code || "Loading..."}
    </div>
  );
}
