/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Minimal MCP-like server over HTTP+SSE for local testing
// - GET /            : landing text
// - GET /healthz     : health check
// - GET /sse         : SSE stream (server -> client)
// - POST /messages   : accept JSON-RPC 2.0 requests (client -> server)

type JsonRpcId = string | number | null
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: any
  error?: { code: number; message: string; data?: any }
}

type SendFn = (msg: unknown) => void

class SseHub {
  private subscribers: Set<SendFn> = new Set()

  subscribe(send: SendFn) {
    this.subscribers.add(send)
    return () => this.subscribers.delete(send)
  }

  broadcast(message: unknown) {
    for (const send of this.subscribers) send(message)
  }
}

const hub = new SseHub()

// Application layer: Hello use-case
import { greet } from './application/hello'
// Mermaid parser (full mermaid). Parse は DOM 依存なく構文チェックに利用可能。
// Cloudflare Workers でもバンドル可能なため、まずはこちらを使用する。
import { getWorkerTools, getSdkTools, callTool } from './mcp/tools'

// Minimal MCP handlers (subset): initialize, tools/list, tools/call, ping
async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const id: JsonRpcId = req.id ?? null
  try {
    switch (req.method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'mermaid-checker-mcp', version: '0.0.1' },
            capabilities: { tools: {} },
          },
        }
      }
      case 'ping': {
        return { jsonrpc: '2.0', id, result: { ok: true, now: Date.now() } }
      }
      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: getSdkTools(),
          },
        }
      }
      case 'tools/call': {
        const { name, arguments: args } = req.params ?? {}
        const result = await callTool(String(name), args ?? {})
        if (result.isError) {
          return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } }
        }
        return { jsonrpc: '2.0', id, result }
      }
      default: {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        }
      }
    }
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err?.message ?? 'Internal error' },
    }
  }
}

function sseHeaders() {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    // allow browser-based clients if needed (ChatGPT may run in browser or server)
    'access-control-allow-origin': '*',
  }
}

function toSseEvent(data: unknown, eventName?: string) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  const eventLine = eventName ? `event: ${eventName}\n` : ''
  return `${eventLine}data: ${payload}\n\n`
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    const rawPath = url.pathname
    const pathname = rawPath.endsWith('/') && rawPath !== '/' ? rawPath.slice(0, -1) : rawPath

    // Basic CORS preflight for POST /messages
    if (request.method === 'OPTIONS') {
      const reqHeaders = request.headers
      if (reqHeaders.get('access-control-request-method')) {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization',
            'access-control-max-age': '600',
          },
        })
      }
    }

    if (request.method === 'GET' && pathname === '/healthz') {
      return new Response('ok', { status: 200 })
    }

    const acceptsEventStream = (request.headers.get('accept') || '').includes('text/event-stream')

    // SSE endpoint: allow both explicit /sse and root path when Accept is event-stream
    if (request.method === 'GET' && (pathname === '/sse' || (pathname === '/' && acceptsEventStream))) {
      let cleanup: (() => void) | undefined
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder()
          const send: SendFn = (msg) => controller.enqueue(encoder.encode(toSseEvent(msg, 'message')))
          const unsubscribe = hub.subscribe(send)

          // Per MCP SSE spec: announce POST endpoint via an endpoint event
          // Use absolute URL to avoid client URL-join pitfalls
          const endpointUrl = `${url.origin}/messages`
          controller.enqueue(encoder.encode(toSseEvent(endpointUrl, 'endpoint')))

          // optional ready ping so clients know stream is alive
          controller.enqueue(encoder.encode(toSseEvent({ type: 'ready', ts: Date.now() }, 'system')))

          // send heartbeat every 25s to keep connections alive through proxies
          const interval = setInterval(() => controller.enqueue(encoder.encode(toSseEvent({ type: 'heartbeat', ts: Date.now() }, 'system'))), 25_000)
          // send initial comment to establish stream for some clients
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
          // Cleanup closure
          cleanup = () => {
            clearInterval(interval as any)
            unsubscribe()
          }
        },
        cancel() {
          if (cleanup) cleanup()
        },
      })
      return new Response(stream, { status: 200, headers: sseHeaders() })
    }

    if (request.method === 'POST' && (pathname === '/messages' || pathname === '/')) {
      const body = await request.json().catch(() => undefined)
      if (!body) return new Response('Bad Request', { status: 400 })

      const requests: JsonRpcRequest[] = Array.isArray(body) ? body : [body]
      const responses: JsonRpcResponse[] = []
      for (const r of requests) {
        const res = await handleRpc(r)
        responses.push(res)
        // push each response to SSE subscribers (like MCP Inspector)
        hub.broadcast(res)
      }

      return new Response(JSON.stringify(Array.isArray(body) ? responses : responses[0]), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      })
    }

    // landing / usage
    return new Response(
      [
        'mermaid-checker-mcp (Hello World) — endpoints:',
        '- GET  /healthz     -> 200 OK',
        '- GET  /sse (or GET / with Accept: text/event-stream) -> SSE',
        '- POST /messages    -> JSON-RPC 2.0 {method:"initialize"|"tools/list"|"tools/call"}',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  },
} satisfies ExportedHandler<Env>
