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

