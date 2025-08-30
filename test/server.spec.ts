import { describe, it, expect } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('Hello World MCP server (minimal)', () => {
  it('GET /healthz -> 200 ok', async () => {
    const res = await SELF.fetch('http://dummy/healthz')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('GET / -> usage text', async () => {
    const res = await SELF.fetch('http://dummy/')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('mermaid-checker-mcp')
    expect(text).toContain('/sse')
    expect(text).toContain('/messages')
  })

  it('POST /messages initialize -> result and SSE broadcast', async () => {
    // Fire a JSON-RPC initialize request
    const initReq = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }
    const res = await SELF.fetch('http://dummy/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initReq),
    })
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.jsonrpc).toBe('2.0')
    expect(payload.id).toBe(1)
    expect(payload.result?.serverInfo?.name).toBeDefined()
  })

  it('POST /messages tools -> hello tool call', async () => {
    // list tools
    const listReq = { jsonrpc: '2.0', id: 2, method: 'tools/list' }
    const listRes = await SELF.fetch('http://dummy/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(listReq),
    })
    expect(listRes.status).toBe(200)
    const listPayload = await listRes.json()
    expect(listPayload.result?.tools?.length).toBeGreaterThan(0)

    // call hello
    const callReq = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'Kaz' } },
    }
    const callRes = await SELF.fetch('http://dummy/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(callReq),
    })
    expect(callRes.status).toBe(200)
    const callPayload = await callRes.json()
    const text = callPayload?.result?.content?.[0]?.text ?? ''
    expect(text).toContain('Hello, Kaz!')
  })

  it('POST /messages tools -> mermaid_validate tool call (valid)', async () => {
    const callReq = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'mermaid_validate', arguments: { code: 'graph TD; A-->B;' } },
    }
    const callRes = await SELF.fetch('http://dummy/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(callReq),
    })
    expect(callRes.status).toBe(200)
    const payload = await callRes.json()
    const text = payload?.result?.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.valid).toBe(true)
  })

  it('POST /messages tools -> mermaid_validate tool call (invalid)', async () => {
    const callReq = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'mermaid_validate', arguments: { code: 'graph TD A-- B;' } },
    }
    const callRes = await SELF.fetch('http://dummy/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(callReq),
    })
    expect(callRes.status).toBe(200)
    const payload = await callRes.json()
    const text = payload?.result?.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    expect(parsed.valid).toBe(false)
    expect(typeof parsed.reason === 'string').toBe(true)
  })
})
