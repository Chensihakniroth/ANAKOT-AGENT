// CodeHighlight — lightweight CSS-based syntax highlighting for NotebookLLM source preview
// No external dependencies — uses regex-based tokenization with colored <span> tags.

// ── Token patterns per language ──────────────────────────────────
type TokenRule = { pattern: RegExp; cls: string };

const KEYWORD = "text-purple-400";
const STRING = "text-emerald-400";
const COMMENT = "text-zinc-500 italic";
const NUMBER = "text-amber-400";
const FUNC = "text-sky-300";
const TYPE = "text-cyan-300";
const OP = "text-rose-400";
const TAG = "text-rose-400";
const ATTR = "text-amber-300";
const PROP = "text-sky-300";

const RULES: Record<string, TokenRule[]> = {
  python: [
    { pattern: /(#.*)$/gm, cls: COMMENT },
    { pattern: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: STRING },
    { pattern: /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|yield|lambda|and|or|not|in|is|True|False|None|async|await|pass|break|continue|global|nonlocal|assert|del)\b/g, cls: KEYWORD },
    { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, cls: NUMBER },
    { pattern: /\b([A-Z]\w*)\b/g, cls: TYPE },
    { pattern: /\b(def\s+)(\w+)/g, cls: FUNC },
  ],
  javascript: [
    { pattern: /(\/\/.*$)/gm, cls: COMMENT },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: COMMENT },
    { pattern: /(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: STRING },
    { pattern: /\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|this|super|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|null|undefined|true|false)\b/g, cls: KEYWORD },
    { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, cls: NUMBER },
    { pattern: /\b([A-Z]\w*)\b/g, cls: TYPE },
  ],
  typescript: [
    { pattern: /(\/\/.*$)/gm, cls: COMMENT },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: COMMENT },
    { pattern: /(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: STRING },
    { pattern: /\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|this|super|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|null|undefined|true|false|interface|type|enum|implements|extends|abstract|declare|readonly|private|protected|public|static|override|as|keyof|infer|never|unknown|any|string|number|boolean|symbol|bigint)\b/g, cls: KEYWORD },
    { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, cls: NUMBER },
  ],
  html: [
    { pattern: /(<!--[\s\S]*?-->)/g, cls: COMMENT },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: STRING },
    { pattern: /(<\/?)([\w-]+)/g, cls: TAG },
    { pattern: /\b([\w-]+)(?==)/g, cls: ATTR },
  ],
  css: [
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: COMMENT },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: STRING },
    { pattern: /(#[0-9a-fA-F]{3,8})\b/g, cls: NUMBER },
    { pattern: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms)?)\b/g, cls: NUMBER },
    { pattern: /([\w-]+)(?=\s*:)/g, cls: PROP },
    { pattern: /(\.[\w-]+)/g, cls: FUNC },
  ],
  json: [
    { pattern: /("(?:[^"\\]|\\.)*")(\s*:)/g, cls: PROP },
    { pattern: /:\s*("(?:[^"\\]|\\.)*")/g, cls: STRING },
    { pattern: /\b(true|false|null)\b/g, cls: KEYWORD },
    { pattern: /\b(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, cls: NUMBER },
  ],
};

// Copy JS rules to JSX
RULES.jsx = RULES.javascript;
RULES.tsx = RULES.typescript;

// ── Simple regex-based highlighter ───────────────────────────────
function highlightCode(code: string, lang: string): string {
  const rules = RULES[lang];
  if (!rules) return escapeHtml(code);

  // Tokenize: find all matches, then sort by position, apply longest-match-first
  type Token = { start: number; end: number; cls: string };
  const tokens: Token[] = [];

  for (const rule of rules) {
    // Reset regex lastIndex for global patterns
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip if overlapping with existing token
      const overlaps = tokens.some(
        (t) => (start >= t.start && start < t.end) || (end > t.start && end <= t.end)
      );
      if (!overlaps) {
        tokens.push({ start, end, cls: rule.cls });
      }
    }
  }

  // Sort by position
  tokens.sort((a, b) => a.start - b.start);

  // Build output
  let result = "";
  let pos = 0;
  for (const tok of tokens) {
    if (tok.start > pos) {
      result += escapeHtml(code.slice(pos, tok.start));
    }
    result += `<span class="${tok.cls}">${escapeHtml(code.slice(tok.start, tok.end))}</span>`;
    pos = tok.end;
  }
  if (pos < code.length) {
    result += escapeHtml(code.slice(pos));
  }
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LANG_MAP: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".html": "html",
  ".css": "css",
  ".json": "json",
};

export function CodeHighlight({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  const lang = LANG_MAP[ext] || "";

  if (lang && code) {
    const html = highlightCode(code, lang);
    return (
      <div className="max-h-96 overflow-y-auto rounded border border-(--ui-stroke-secondary) bg-[#0d1117] p-3">
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    );
  }

  // Fallback: plain monospace
  return (
    <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-(--ui-stroke-secondary) bg-(--ui-surface-elevated) p-3 font-mono text-[11px] leading-relaxed text-(--ui-text-secondary)">
      {code || "Loading..."}
    </div>
  );
}
