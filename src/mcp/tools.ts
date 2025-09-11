import mermaid from 'mermaid'
import { greet } from '../application/hello'

export type WorkerTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type SdkTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export function getWorkerTools(): WorkerTool[] {
  return [
    {
      name: 'hello',
      description: '名前を受け取り、Helloを返す最小ツール',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'あいさつする相手の名前' },
        },
        required: ['name'],
      },
    },
    {
      name: 'search',
      description: 'コネクター要件準拠の簡易検索。queryに一致する項目IDを返す',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '検索クエリ' },
          top_k: { type: 'number', description: '最大件数（任意）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch',
      description: 'searchで得たobjectIdsを取得して内容を返す',
      input_schema: {
        type: 'object',
        properties: {
          objectIds: { type: 'array', items: { type: 'string' }, description: '取得対象IDの配列' },
        },
        required: ['objectIds'],
      },
    },
    {
      name: 'mermaid_validate',
      description: 'Mermaidの全文を受け取り構文チェックを行う',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mermaidコード全文' },
        },
        required: ['code'],
      },
    },
  ]
}

export function getSdkTools(): SdkTool[] {
  return [
    {
      name: 'hello',
      description: '名前を受け取り、Helloを返す最小ツール',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'あいさつする相手の名前' },
        },
        required: ['name'],
      },
    },
    {
      name: 'search',
      description: 'コネクター要件準拠の簡易検索。queryに一致する項目IDを返す',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '検索クエリ' },
          top_k: { type: 'number', description: '最大件数（任意）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch',
      description: 'searchで得たobjectIdsを取得して内容を返す',
      inputSchema: {
        type: 'object',
        properties: {
          objectIds: { type: 'array', items: { type: 'string' }, description: '取得対象IDの配列' },
        },
        required: ['objectIds'],
      },
    },
    {
      name: 'mermaid_validate',
      description: 'Mermaidの全文を受け取り構文チェックを行う',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Mermaidコード全文' },
        },
        required: ['code'],
      },
    },
  ]
}

export async function callTool(name: string, args: Record<string, unknown>) {
  if (name === 'hello') {
    const text = greet(String(args?.name ?? ''))
    return { content: [{ type: 'text', text }], isError: false }
  }
  if (name === 'search') {
    const query = String(args?.query ?? '').trim().toLowerCase()
    const topK = Math.max(1, Math.min(50, Number(args?.top_k ?? 5)))
    const items: Array<{ id: string; title: string; snippet: string; url?: string }> = []

    // 最小実装: Mermaid関連クエリに対して1件返す。他は空配列。
    if (query.includes('mermaid') || query.includes('diagram')) {
      items.push({
        id: 'doc:mermaid:validate',
        title: 'Mermaid 構文チェック',
        snippet: 'mermaid_validate ツールでMermaidコードの構文を検証します。',
        url: 'https://mermaid.js.org',
      })
    }

    const result = { items: items.slice(0, topK), total: items.length }
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false }
  }
  if (name === 'fetch') {
    const ids: string[] = Array.isArray((args as any)?.objectIds) ? ((args as any).objectIds as string[]) : []
    const resources = ids.map((id) => {
      if (id === 'doc:mermaid:validate') {
        return {
          id,
          mimeType: 'text/markdown',
          text: [
            '# Mermaid 構文チェック',
            '',
            '- ツール名: mermaid_validate',
            '- 入力: { code: string }',
            '- 出力: { valid: boolean, reason?: string } をJSON文字列で返却',
          ].join('\n'),
        }
      }
      return { id, mimeType: 'text/plain', text: `No content for ${id}` }
    })
    const result = { resources }
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false }
  }
  if (name === 'mermaid_validate') {
    const code = String(args?.code ?? '')
    try {
      await mermaid.parse(code)
      return { content: [{ type: 'text', text: JSON.stringify({ valid: true }) }], isError: false }
    } catch (e: any) {
      return {
        content: [
          { type: 'text', text: JSON.stringify({ valid: false, reason: e?.message ?? String(e) }) },
        ],
        isError: false,
      }
    }
  }
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
}
