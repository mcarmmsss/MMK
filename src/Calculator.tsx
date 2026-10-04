import { useRef, useState, type KeyboardEvent } from 'react'
import closeIcon from '../SVG/Close_square_fill.svg'
import { evaluateArithmeticExpression, formatArithmeticResult } from './mathExpression'

type CalculatorProps = { onHide: () => void }

export default function Calculator({ onHide }: CalculatorProps) {
  const [expression, setExpression] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const expressionRef = useRef<HTMLInputElement>(null)
  const result = expression.trim() ? evaluateArithmeticExpression(expression) : 0

  function clear() {
    setExpression('')
    setCopyStatus('')
    requestAnimationFrame(() => {
      expressionRef.current?.focus()
      expressionRef.current?.setSelectionRange(0, 0)
    })
  }

  function insertToken(token: string) {
    const input = expressionRef.current
    let start = Math.min(input?.selectionStart ?? expression.length, expression.length)
    const end = Math.min(input?.selectionEnd ?? expression.length, expression.length)
    if (/^\d$/.test(token) && expression === '0' && start === 1 && end === 1) start = 0
    const next = `${expression.slice(0, start)}${token}${expression.slice(end)}`
    setExpression(next)
    setCopyStatus('')
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  function deleteToken() {
    const input = expressionRef.current
    let start = Math.min(input?.selectionStart ?? expression.length, expression.length)
    const end = Math.min(input?.selectionEnd ?? expression.length, expression.length)
    if (start === end && start > 0) start -= 1
    if (start === end) return
    const next = `${expression.slice(0, start)}${expression.slice(end)}`
    setExpression(next)
    setCopyStatus('')
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start, start)
    })
  }

  function applyPercent() {
    const input = expressionRef.current
    const cursor = Math.min(input?.selectionStart ?? expression.length, expression.length)
    const prefix = expression.slice(0, cursor)
    const match = prefix.match(/(\d+(?:\.\d*)?|\.\d+)$/)
    if (!match) return
    const start = cursor - match[0].length
    const next = `${prefix.slice(0, start)}(${match[0]}/100)${expression.slice(cursor)}`
    setExpression(next)
    setCopyStatus('')
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + match[0].length + 5, start + match[0].length + 5)
    })
  }

  function evaluate(restoreFocus = true) {
    if (result === null) return
    const formatted = formatArithmeticResult(result)
    setExpression(formatted)
    setCopyStatus('')
    if (!restoreFocus) return
    requestAnimationFrame(() => {
      expressionRef.current?.focus()
      expressionRef.current?.setSelectionRange(formatted.length, formatted.length)
    })
  }

  function commitOnBlur(event: React.FocusEvent<HTMLInputElement>) {
    const panel = event.currentTarget.closest('.calculator-panel')
    if (event.relatedTarget instanceof Node && panel?.contains(event.relatedTarget)) return
    evaluate(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault()
      evaluate()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      clear()
      return
    }
    if (event.target instanceof HTMLInputElement) return
    if (/^\d$/.test(event.key) || ['+', '-', '*', '/', '%', '(', ')', '.'].includes(event.key)) {
      event.preventDefault()
      insertToken(event.key === '-' ? '−' : event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      deleteToken()
    }
  }

  async function copyValue() {
    if (result === null) return
    try {
      await navigator.clipboard.writeText(formatArithmeticResult(result))
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable')
    }
  }

  return (
    <aside className="calculator-panel" aria-label="Calculator" onKeyDown={handleKeyDown}>
      <div className="calculator-heading">
        <div><p className="eyebrow">QUICK TOOL</p><h2>Calculator</h2></div>
        <button className="calculator-hide" type="button" onClick={onHide} aria-label="Hide calculator" title="Hide calculator"><img src={closeIcon} alt="" /></button>
      </div>
      <div className={`calculator-display ${expression.trim() && result === null ? 'has-error' : ''}`}>
        <div className="calculator-expression-row">
          <input ref={expressionRef} className="calculator-expression" type="text" inputMode="decimal" aria-label="Calculator expression" placeholder="0" value={expression} onChange={(event) => { setExpression(event.target.value); setCopyStatus('') }} onBlur={commitOnBlur} />
          <button className="calculator-copy" type="button" onClick={copyValue} disabled={result === null} aria-label="Copy calculated value" title="Copy calculated value">Copy</button>
        </div>
        <div className="calculator-result-row"><span aria-live="polite">{copyStatus || (result === null ? 'Check expression' : 'Result')}</span><output aria-live="polite">{result === null ? '—' : formatArithmeticResult(result)}</output></div>
      </div>
      <div className="calculator-keypad">
        <button className="calculator-key utility-key clear-key" type="button" onClick={clear}>AC</button>
        <button className="calculator-key utility-key" type="button" onClick={deleteToken} aria-label="Delete selection or previous character" title="Delete selection or previous character">DEL</button>
        <button className="calculator-key utility-key" type="button" onClick={() => insertToken('(')} aria-label="Open parenthesis">(</button>
        <button className="calculator-key utility-key" type="button" onClick={() => insertToken(')')} aria-label="Close parenthesis">)</button>
        <button className="calculator-key operator-key" type="button" onClick={() => insertToken('÷')} aria-label="Divide">÷</button>
        {['7', '8', '9'].map((digit) => <button className="calculator-key" key={digit} type="button" onClick={() => insertToken(digit)}>{digit}</button>)}
        <button className="calculator-key utility-key" type="button" onClick={applyPercent} aria-label="Convert to percent">%</button>
        <button className="calculator-key operator-key" type="button" onClick={() => insertToken('×')} aria-label="Multiply">×</button>
        {['4', '5', '6'].map((digit) => <button className="calculator-key" key={digit} type="button" onClick={() => insertToken(digit)}>{digit}</button>)}
        <button className="calculator-key" type="button" onClick={() => insertToken('.')}>.</button>
        <button className="calculator-key operator-key" type="button" onClick={() => insertToken('−')} aria-label="Subtract">−</button>
        {['1', '2', '3'].map((digit) => <button className="calculator-key" key={digit} type="button" onClick={() => insertToken(digit)}>{digit}</button>)}
        <button className="calculator-key operator-key" type="button" onClick={() => insertToken('+')} aria-label="Add">+</button>
        <button className="calculator-key zero-key" type="button" onClick={() => insertToken('0')}>0</button>
        <button className="calculator-key equals-key" type="button" onClick={() => evaluate()} aria-label="Equals">=</button>
      </div>
      <p className="calculator-hint" aria-live="polite">{copyStatus && copyStatus !== 'Copied' ? copyStatus : ' '}</p>
    </aside>
  )
}