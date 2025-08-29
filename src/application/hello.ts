export function greet(name: string) {
  const who = (name ?? '').toString().trim() || 'World'
  return `Hello, ${who}!`
}

