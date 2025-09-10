# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Cloudflare Workers + MCP 実装。`index.ts`(HTTP+SSE/JSON‑RPC), `mcp/tools.ts`(ツール定義), `application/hello.ts`(ドメイン最小例), `stdio-server.ts`(MCP stdio サーバ)。
- `test/`: Vitest（Workers プール）による単体/統合テスト。`server.spec.ts`, `index.spec.ts`。
- `scripts/`: 補助スクリプト（例: `probe-stdio.mjs`, `test-mermaid-parse.mjs`）。
- `docs/`: 設計メモ。/ ルートには `wrangler.jsonc`, `tsconfig.json`, `vitest.config.mts`。

## Build, Test, and Development Commands
- 開発サーバ: `npm run dev` または `npm start`（`http://localhost:8787`）。
- テスト: `npm test`（Vitest; Cloudflare Workers 上で実行）。
- デプロイ: `npm run deploy`（Wrangler）。型生成: `npm run cf-typegen`。
- MCP(stdio) ローカル実行: `npm run mcp`（要 Bun）。

## Coding Style & Naming Conventions
- 言語は TypeScript。インデントはタブ（`.editorconfig`）。
- Prettier 設定: `printWidth=140`, `singleQuote`, `semi`, `useTabs`（`.prettierrc`）。
- ファイル名は既存に合わせて小文字/kebab（例: `mermaid-validate.ts`）。テストは `*.spec.ts`。
- 型安全を優先し、`zod` など既存依存を活用。

## Testing Guidelines
- 重要ロジック/ツール追加時は単体＋統合の両方を更新。
- 命名: `<対象>.spec.ts`。Workers 統合は `SELF.fetch(...)` を用いる。
- `tools` を増やす場合: `getWorkerTools`/`getSdkTools`/`callTool` に追記し、`server.spec.ts` にケースを追加。

## Commit & Pull Request Guidelines
- 既存履歴は短い日本語サマリ中心（例:「リファクタ、ツール共通化」）。
- 推奨: 簡潔な命令形＋任意スコープ（例: `feat: mermaid 構文チェック` / `test: server spec 追加`）。
- PR には What/Why、関連 Issue、動作確認方法（`curl` 例や Inspector のスクショ）、テスト結果を添付。

## Security & Configuration Tips
- 機密は Git へコミットしない。`wrangler secret put <NAME>` を使用。
- `wrangler.jsonc` の `compatibility_date` は固定し、変更時は回帰確認。
- 外部エンドポイント/ツール名を変える場合はテストと README を同時更新。

## Agent-Specific Notes
- 不要な大規模リファクタは避け、差分を最小化。Prettier を必ず適用。
- 仕様変更時はテストを先に書き、`src` と `test` をセットで更新すること。

