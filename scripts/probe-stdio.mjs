import { spawn } from 'node:child_process'

const cmd = 'node'
const args = ['src/stdio-server.mjs']

const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] })

const req = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'probe', version: '0.0.0' },
  },
}
const json = JSON.stringify(req)
const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`

let buf = Buffer.alloc(0)
let timer = setTimeout(() => {
  console.error('Timed out waiting for response')
  child.kill('SIGKILL')
  process.exit(1)
}, 8000)

child.stdout.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  // Look for header terminator
  const headerEnd = buf.indexOf('\r\n\r\n')
  if (headerEnd === -1) return
  const header = buf.slice(0, headerEnd).toString('utf8')
  const match = /Content-Length: (\d+)/i.exec(header)
  if (!match) return
  const len = Number(match[1])
  const start = headerEnd + 4
  if (buf.length < start + len) return
  const body = buf.slice(start, start + len).toString('utf8')
  try {
    const msg = JSON.parse(body)
    clearTimeout(timer)
    console.log('Received response:', JSON.stringify(msg))
    child.kill('SIGKILL')
    process.exit(0)
  } catch (e) {
    clearTimeout(timer)
    console.error('Invalid JSON body:', body)
    child.kill('SIGKILL')
    process.exit(1)
  }
})

// Send request
child.stdin.write(payload)
