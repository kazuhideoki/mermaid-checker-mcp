import mermaid from 'mermaid'

try {
  const ok = await mermaid.parse('graph TD; A-->B;')
  console.log('parse ok:', ok)
} catch (e) {
  console.error('parse error:', e?.message ?? String(e))
  process.exit(1)
}
