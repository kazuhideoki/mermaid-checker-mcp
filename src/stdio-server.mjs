// Minimal local MCP server over STDIO for Codex
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import mermaid from 'mermaid'

const server = new Server(
  { name: 'mermaid-checker-mcp', version: '0.0.1' },
  { capabilities: { tools: {} } },
)

// tools/list
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
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
  ],
}))

// tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params ?? {}
  if (name === 'hello') {
    const who = String(args?.name ?? '')
    return {
      content: [{ type: 'text', text: `Hello, ${who}!` }],
      isError: false,
    }
  }
  if (name === 'mermaid_validate') {
    const code = String(args?.code ?? '')
    try {
      await mermaid.parse(code)
      const payload = { valid: true }
      return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false }
    } catch (e) {
      const payload = { valid: false, reason: e?.message ?? String(e) }
      return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false }
    }
  }
  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  }
})

await server.connect(new StdioServerTransport())
