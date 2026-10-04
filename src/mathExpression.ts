import jsep from 'jsep'

export function evaluateArithmeticExpression(expression: string): number | null {
  const normalized = expression.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
  if (!normalized.trim() || normalized.length > 120 || !/^[\d\s()+\-*/%.]+$/.test(normalized)) return null
  try {
    const evaluateNode = (node: unknown): number | null => {
      if (typeof node !== 'object' || node === null) return null
      const parsed = node as { type?: string; value?: unknown; operator?: string; left?: unknown; right?: unknown; argument?: unknown }
      if (parsed.type === 'Literal') return typeof parsed.value === 'number' ? parsed.value : null
      if (parsed.type === 'UnaryExpression') {
        const value = evaluateNode(parsed.argument)
        if (value === null) return null
        return parsed.operator === '-' ? -value : parsed.operator === '+' ? value : null
      }
      if (parsed.type !== 'BinaryExpression') return null
      const left = evaluateNode(parsed.left)
      const right = evaluateNode(parsed.right)
      if (left === null || right === null) return null
      if (parsed.operator === '+') return left + right
      if (parsed.operator === '-') return left - right
      if (parsed.operator === '*') return left * right
      if (parsed.operator === '/') return left / right
      if (parsed.operator === '%') return left % right
      return null
    }
    const result = evaluateNode(jsep(normalized))
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export function formatArithmeticResult(value: number) {
  return String(Number(value.toPrecision(10)))
}