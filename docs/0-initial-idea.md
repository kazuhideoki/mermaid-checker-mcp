了解。**Cloudflare Workers**の公式ガイドに沿って、**bun + TypeScript**で\*\*“Hello World”のリモートMCPサーバ**を用意し、ローカル実行→本番デプロイまで一気通貫で解説します。
（以下は**認証なしの最小構成\*\*。まずは動かし、後でOAuth等を足す方針です）

---

## 全体像

* **Transport**：Cloudflareのテンプレートは既定で**HTTP+SSE**のエンドポイント（`/sse`）を公開します。MCP自体は**Streamable HTTP**が推奨で、SSEは後方互換扱いですが、まずはSSEで最短動作→必要に応じて拡張でOKです。([Cloudflare Docs][1], [Model Context Protocol][2], [GitHub][3])
* **ローカルURL**：`http://localhost:8788/sse`（テンプレートのデフォルト）で接続テストします。 ([Cloudflare Docs][1])
* **検証用クライアント**：**MCP Inspector** or **Cloudflare AI Playground**を使います。([Cloudflare Docs][1], [npm][4])

---

## 1) インフラ側の準備（Cloudflare & Wrangler）

1. **Cloudflareアカウント**を用意（Freeで十分）。
2. ローカルに**Wrangler CLI**を入れてログイン

   ```bash
   # Node/npm経由（推奨）
   npm i -g wrangler
   wrangler login
   ```

   WranglerはWorkersの公式CLIです（ログインはOAuthでブラウザ承認）。([Cloudflare Docs][5], [npm][6])
3. **TypeScript**の型は`@cloudflare/workers-types`ではなく\*\*`wrangler types`\*\*の生成を使うのが現行推奨です（後述のテンプレートは設定済み）。([Cloudflare Docs][7])

> ※実行ランタイムはCloudflareの**V8**で、**Bunはパッケージマネージャ/スクリプト実行**に使います（Bun自体がWorkers上で動くわけではありません）。([Cloudflare Community][8])

---

## 2) プロジェクト作成（bun + TypeScript）

公式の\*\*「リモートMCPサーバ（認証なし）」テンプレート\*\*から雛形を作ります。([Cloudflare Docs][1])

```bash
# bun で C3（create cloudflare）を起動
bun create cloudflare@latest -- my-mcp-server \
  --template=cloudflare/ai/demos/remote-mcp-authless

cd my-mcp-server
bun install
```

> `bun create cloudflare` はサポートされています（JSRの公式ドキュメントにも記載）。npm/yarn/pnpmでも可です。([JSR][9])

ローカル実行：

```bash
# テンプレートの start スクリプト経由
bun run start
# => http://localhost:8788/sse で起動（テンプレート既定）
```

このテンプレートは、**Workers.dev上へそのままデプロイ可能**で、**MCPクライアント（Inspector/AI Playground）から直に接続**できます。([Cloudflare Docs][1])

---

## 3) 「Hello World」ツールを追加

テンプレートには`src/index.ts`に**MCPサーバの定義**があります。CloudflareのAgentsパッケージでは、**TypeScript SDKと同じ要領**で\*\*`this.server.tool(...)`\*\*を使い、MCPツールを登録します。([Cloudflare Docs][10])

### 追加するコード（`src/index.ts` の `init()` 内に追記）

```ts
import { z } from "zod";
// 既存：import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
// 既存：import { McpAgent } from "agents/mcp";

// ・・・既存のクラス定義内
export class MyMCP extends McpAgent {
  server = new McpServer({ name: "hello-mcp", version: "0.1.0" });

  async init() {
    // ★ Hello World ツール
    this.server.tool(
      "hello",
      {
        // 引数スキーマ
        name: z.string().describe("あいさつする相手の名前"),
      },
      async ({ name }) => ({
        // MCPのツール出力（content配列）
        content: [{ type: "text", text: `Hello, ${name}!` }],
      }),
    );

    // （他の既存ツールがあればそのままでOK）
  }
}

// （テンプレート既存のexportはそのまま）
```

> Cloudflareのドキュメントも、**MCP TypeScript SDKの作法に沿ってツールを定義**することを示しています。([Cloudflare Docs][10])
> MCP SDK（公式）側のツール登録イメージも参考になります。([GitHub][3])

---

## 4) ローカルで動作確認（Inspector / Playground）

1. **MCP Inspector**を起動し、`http://localhost:8788/sse`へ接続

```bash
npx @modelcontextprotocol/inspector@latest
# ブラウザで http://localhost:5173 を開く
# URL に http://localhost:8788/sse を入れて Connect
```

ツール一覧に`hello`が出ればOK。引数`{"name":"カズくん"}`で呼ぶと`Hello, カズくん!`が返ります。([Cloudflare Docs][1], [npm][4])

2. **Cloudflare AI Playground**からも接続可（同じく`/sse`）。([Cloudflare Docs][1])

> （補足）InspectorやPlaygroundは**リモートMCPクライアント**としてSSEで繋がります。MCPのトランスポートは**Streamable HTTP**が現行の推奨ですが、テンプレートのSSEエンドポイントでまずは動かせます。([Model Context Protocol][2], [GitHub][3])

---

## 5) 本番にデプロイ（Workers.dev）

```bash
# bunxが安定しない環境では npx を使ってください
bunx wrangler deploy
# もしくは
npx wrangler@latest deploy
```

デプロイ後、**`https://<worker-name>.<account>.workers.dev/sse`** が公開されます（ガイド記載）。Inspector/Playgroundの接続先をこのURLに変えれば、**リモートMCPサーバ**として利用できます。([Cloudflare Docs][1])

> 設定ファイルは最近のWranglerでは **`wrangler.jsonc` 推奨**です（テンプレ雛形に準拠）。必要なら`name`や`main`、`compatibility_date`などを調整してください。([Cloudflare Docs][11])

---

## 6) Claude Desktop等から使う（任意）

現状「リモート接続未対応」のクライアントへは\*\*`mcp-remote`ローカルプロキシ\*\*で橋渡しできます。Cloudflareガイドの例：

```json
{
  "mcpServers": {
    "hello": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker-name.your-account.workers.dev/sse"]
    }
  }
}
```

（Claude Desktopの設定に追記→再起動）([Cloudflare Docs][1])

---

## 7) Tips（型、Bun運用、SSEと今後）

* **型**：Workersの型は`wrangler types`生成が最新推奨（`@cloudflare/workers-types`より正確）。([Cloudflare Docs][7])
* **Bunの立ち位置**：**パッケージ管理やスクリプト実行**に使えます。\*\*本番ランタイムはWorkers(V8)\*\*です。([Cloudflare Community][8])
* **Transportの今**：MCPは**Streamable HTTP**が中心。テンプレはSSE `/sse`を提供しますが、将来は**両対応**や**HTTP一本化**へ移行の可能性があります（SDKは両方サポート、SSEは後方互換）。([Model Context Protocol][2], [GitHub][3])

---

## 8) 作業ログ（最短手順まとめ）

```bash
# 0) 前提：wrangler login 済み（npm推奨）
npm i -g wrangler
wrangler login

# 1) 雛形作成（bun）
bun create cloudflare@latest -- my-mcp-server \
  --template=cloudflare/ai/demos/remote-mcp-authless
cd my-mcp-server
bun install

# 2) Helloツール追加（src/index.ts の init() に this.server.tool(...) を追記）

# 3) ローカル起動
bun run start
# => http://localhost:8788/sse

# 4) Inspectorで接続・テスト
npx @modelcontextprotocol/inspector@latest
# => http://localhost:5173 を開き、http://localhost:8788/sse に Connect

# 5) デプロイ
bunx wrangler deploy
# => https://<worker>.<account>.workers.dev/sse
```

---

## 参考（公式ドキュメント）

* **Cloudflare：リモートMCPサーバをWorkersにデプロイ**（テンプレ、ローカルURL、デプロイ、Inspector/Playground接続）([Cloudflare Docs][1])
* **MCPのトランスポート（Streamable HTTP / SSE）**（概念と推奨）([Model Context Protocol][2])
* **MCP TypeScript SDK（ツール定義の作法・例）**([GitHub][3])
* **Cloudflare Agents：MCPの“ツール”定義はSDKと同じ構文**（`this.server.tool(...)`）([Cloudflare Docs][10])
* **WorkersのTypeScriptガイド（wrangler types推奨）**([Cloudflare Docs][7])

---

### 次の一手

ここまでできれば、**Mermaid構文チェック**用のツール（`validate_mermaid(code: string)`）を`this.server.tool(...)`で追加できます。必要なら、**`@mermaid-js/parser`を使ったWorkers実装**のサンプルもこのままの構成に追記できます。

[1]: https://developers.cloudflare.com/agents/guides/remote-mcp-server/ "Build a Remote MCP server · Cloudflare Agents docs"
[2]: https://modelcontextprotocol.io/docs/concepts/transports?utm_source=chatgpt.com "Transports"
[3]: https://github.com/modelcontextprotocol/typescript-sdk "GitHub - modelcontextprotocol/typescript-sdk: The official TypeScript SDK for Model Context Protocol servers and clients"
[4]: https://www.npmjs.com/package/%40modelcontextprotocol/inspector?utm_source=chatgpt.com "modelcontextprotocol/inspector"
[5]: https://developers.cloudflare.com/workers/wrangler/install-and-update/?utm_source=chatgpt.com "Install/Update Wrangler · Cloudflare Workers docs"
[6]: https://www.npmjs.com/package/%40cloudflare/wrangler?utm_source=chatgpt.com "cloudflare/wrangler"
[7]: https://developers.cloudflare.com/workers/languages/typescript/?utm_source=chatgpt.com "Write Cloudflare Workers in TypeScript"
[8]: https://community.cloudflare.com/t/bun-apps-support/406644?utm_source=chatgpt.com "Bun apps support - Cloudflare Workers"
[9]: https://jsr.io/docs/with/cloudflare-workers?utm_source=chatgpt.com "Using JSR with Cloudflare Workers - Docs"
[10]: https://developers.cloudflare.com/agents/model-context-protocol/tools/ "Tools · Cloudflare Agents docs"
[11]: https://developers.cloudflare.com/workers/wrangler/configuration/?utm_source=chatgpt.com "Configuration - Wrangler · Cloudflare Workers docs"
