// PostToolUse hook: formats a file with Prettier right after Claude Code edits or writes it.
// Claude Code passes the tool call as JSON on stdin; we only need tool_input.file_path.
// Silent and harmless when Prettier isn't installed yet (before WBS 2.1). --ignore-unknown skips
// file types Prettier can't format, so there is no extension list to keep up to date.
// Docs: https://code.claude.com/docs/en/hooks

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettierBin = path.join(projectDir, "node_modules", "prettier", "bin", "prettier.cjs");
if (!existsSync(prettierBin) || !existsSync(filePath)) process.exit(0);

// No skip list here: Prettier reads .prettierignore even for a file named on the command line,
// so data/, docs/ and design/ stay untouched. .prettierignore is the one list.
const relative = path.relative(projectDir, filePath).split(path.sep).join("/");

try {
  execFileSync(process.execPath, [prettierBin, "--write", "--ignore-unknown", "--log-level", "warn", filePath], { stdio: "pipe" });
} catch (error) {
  // Exit 2 shows stderr to Claude as a warning; the edit itself already happened.
  process.stderr.write(`Prettier could not format ${relative}: ${error.stderr?.toString() ?? error.message}`);
  process.exit(2);
}
