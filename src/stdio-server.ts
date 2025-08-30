import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getSdkTools, callTool } from './mcp/tools'

const server = new Server(
  { name: 'mermaid-checker-mcp', version: '0.0.1' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getSdkTools() }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params ?? {}
  const result = await callTool(String(name), (args as any) ?? {})
  return result
})

await server.connect(new StdioServerTransport())

