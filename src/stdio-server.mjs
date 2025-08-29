// Minimal local MCP server over STDIO for Codex
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

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
  ],
}))

// tools/call
server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params ?? {}
  if (name !== 'hello') {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  }
  const who = String(args?.name ?? '')
  return {
    content: [{ type: 'text', text: `Hello, ${who}!` }],
    isError: false,
  }
})

await server.connect(new StdioServerTransport())
