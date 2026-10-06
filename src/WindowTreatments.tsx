import { useEffect, useRef, useState } from 'react'
import addIcon from '../SVG/Add_ring_fill.svg'
import trashIcon from '../SVG/Trash.svg'
import { calculateWindowTreatment, createWindowTreatment, fromWindowInches, toWindowInches, type WindowLengthUnit, type WindowTreatmentItem } from './windowTreatmentMath'

type Props = {
  treatments: WindowTreatmentItem[]
  onChange: (treatments: WindowTreatmentItem[]) => void
  formatMoney: (value: number) => string
}

function dimension(value: number) {
  return Number(value.toFixed(2)).toString()
}

function WindowNumberInput({ value, label, onValueChange }: { value: number; label: string; onValueChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value))
  }, [value])

  return <input
    ref={inputRef}
    type="text"
    inputMode="decimal"
    aria-label={label}
    value={draft}
    onChange={(event) => {
      const next = event.currentTarget.value
      setDraft(next)
      if (next === '') return
      const parsed = Number(next)
      if (/^\d*\.?\d*$/.test(next) && Number.isFinite(parsed)) onValueChange(parsed)
    }}
    onBlur={() => {
      if (draft === '') {
        onValueChange(0)
        setDraft('0')
        return
      }
      if (!/^\d*\.?\d+$/.test(draft)) setDraft(String(value))
    }}
  />
}

export default function WindowTreatments({ treatments, onChange, formatMoney }: Props) {
  const [canvasUnit, setCanvasUnit] = useState<WindowLengthUnit>('in')
  const updateTreatment = (id: string, update: (treatment: WindowTreatmentItem) => WindowTreatmentItem) => {
    onChange(treatments.map((treatment) => treatment.id === id ? update(treatment) : treatment))
  }

  const addTreatment = () => onChange([...treatments, createWindowTreatment(`Window ${treatments.length + 1}`)])
  const total = treatments.reduce((sum, treatment) => sum + calculateWindowTreatment(treatment).cost, 0)

  return (
    <section className="window-workspace">
      <div className="window-page-heading">
        <div><p className="eyebrow">FABRIC &amp; COST ESTIMATE</p><h2>Window treatments</h2></div>
        <button className="new-tile-set-button" type="button" onClick={addTreatment}><img src={addIcon} alt="" /> Add window</button>
      </div>
      <p className="window-intro">Add each window separately. Measurements and fabric calculations are in inches; prices are in Philippine pesos per yard.</p>
      {treatments.length === 0
        ? <p className="window-empty">No windows yet. Add a window to calculate its fabric and cost.</p>
        : <div className="window-treatment-list">{treatments.map((treatment, index) => {
          const result = calculateWindowTreatment(treatment)
          const fabricWidth = treatment.fabricWidth ?? 0
          const fullness = treatment.fullness ?? 0
          const previewScale = result.dimensionsEntered
            ? Math.min(380 / result.horizontalCoverage, 215 / result.fabricDrop)
            : 1
          const previewWidth = result.horizontalCoverage * previewScale
          const previewHeight = result.fabricDrop * previewScale
          const previewX = (560 - previewWidth) / 2
          const previewY = (340 - previewHeight) / 2 + 8
          const frameSide = treatment.sideAllowance * previewScale
          const frameTop = (12 + treatment.topExtra) * previewScale
          const frameX = previewX + frameSide
          const frameY = previewY + frameTop
          const frameWidth = treatment.width * previewScale
          const frameHeight = treatment.height * previewScale
          const previewMiddle = previewX + previewWidth / 2
          const foldCount = Math.round((fullness || 1) * 4)
          const folds = (start: number, end: number) => Array.from({ length: foldCount + 1 }, (_, fold) => {
            const x = start + (end - start) * fold / foldCount
            const direction = fold % 2 === 0 ? 1 : -1
            const amplitude = Math.min(5, (end - start) / foldCount * 0.22)
            return <path key={`${start}-${fold}`} d={`M ${x} ${previewY + 5} C ${x + amplitude * direction} ${previewY + previewHeight * 0.32}, ${x - amplitude * direction} ${previewY + previewHeight * 0.68}, ${x} ${previewY + previewHeight - 5}`} fill="none" stroke={fold % 2 === 0 ? '#e6c5a4' : '#755940'} strokeOpacity={fold % 2 === 0 ? 0.68 : 0.72} strokeWidth={Math.max(1, previewWidth / 300)} />
          })
          const updateNumber = (field: 'width' | 'height' | 'sideAllowance' | 'topExtra' | 'bottomExtra' | 'pricePerYard', value: number) => {
            if (!Number.isFinite(value)) return
            updateTreatment(treatment.id, (current) => ({ ...current, [field]: Math.max(0, value) }))
          }
          const dimensionInput = (label: string, value: number, unit: WindowLengthUnit, dimensionKey: 'width' | 'height') => (
            <label className="window-field">
              <span>{label}</span>
              <span className="input-wrap window-dimension-input">
                <WindowNumberInput label={label} value={Number(fromWindowInches(value, unit).toFixed(4))} onValueChange={(entered) => updateTreatment(treatment.id, (current) => ({ ...current, [dimensionKey]: Math.max(0, toWindowInches(entered, unit)) }))} />
                <select aria-label={`${label} unit`} value={unit} onChange={(event) => updateTreatment(treatment.id, (current) => ({ ...current, [`${dimensionKey}Unit`]: event.target.value as WindowLengthUnit }))}>
                  <option value="in">in</option><option value="ft">ft</option><option value="cm">cm</option><option value="mm">mm</option>
                </select>
              </span>
            </label>
          )
          const measurement = (label: string, value: number, field: 'width' | 'height' | 'sideAllowance' | 'topExtra' | 'bottomExtra') => (
            <label className="window-field">
              <span>{label}</span>
              <span className="input-wrap"><WindowNumberInput label={label} value={value} onValueChange={(next) => updateNumber(field, next)} /><small>in</small></span>
            </label>
          )

          return (
            <article className="window-treatment-card" key={treatment.id}>
              <header className="window-card-heading">
                <span className="room-item-index">{String(index + 1).padStart(2, '0')}</span>
                <input className="window-name-input" aria-label={`Window ${index + 1} name`} value={treatment.name} onChange={(event) => updateTreatment(treatment.id, (current) => ({ ...current, name: event.target.value }))} />
                <button className="remove-subsection" type="button" onClick={() => onChange(treatments.filter((entry) => entry.id !== treatment.id))} aria-label={`Remove ${treatment.name || `window ${index + 1}`}`}><img src={trashIcon} alt="" /></button>
              </header>
              <div className="window-fields">
                {dimensionInput('A · Window width', treatment.width, treatment.widthUnit ?? 'in', 'width')}
                {dimensionInput('B · Window height', treatment.height, treatment.heightUnit ?? 'in', 'height')}
                {measurement('Side allowance (each side) · recommended 5–10 in', treatment.sideAllowance, 'sideAllowance')}
                {measurement('C1 · Top extra drop', treatment.topExtra, 'topExtra')}
                {measurement('C2 · Bottom extra drop', treatment.bottomExtra, 'bottomExtra')}
                <label className="window-field"><span>Fabric width</span><select value={treatment.fabricWidth ?? ''} onChange={(event) => updateTreatment(treatment.id, (current) => ({ ...current, fabricWidth: event.target.value === '' ? null : Number(event.target.value) as 60 | 110 }))}><option value="">Select fabric width</option><option value={60}>60 in</option><option value={110}>110 in</option></select></label>
                <label className="window-field"><span>X · Fullness</span><select value={treatment.fullness ?? ''} onChange={(event) => updateTreatment(treatment.id, (current) => ({ ...current, fullness: event.target.value === '' ? null : Number(event.target.value) as WindowTreatmentItem['fullness'] }))}><option value="">Select fullness</option><option value={1}>1× · Flat</option><option value={2}>2× · Minimal</option><option value={2.4}>2.4× · Regular</option><option value={2.6}>2.6× · Recommended</option><option value={3}>3× · Extra wide</option></select></label>
                <label className="window-field"><span>Price per yard</span><span className="currency-input"><span>₱</span><WindowNumberInput label="Price per yard" value={treatment.pricePerYard} onValueChange={(next) => updateNumber('pricePerYard', next)} /></span></label>
              </div>
              <figure className="window-preview">
                <figcaption><span>CANVAS PREVIEW</span><label>Dimension labels <select aria-label="Canvas dimension units" value={canvasUnit} onChange={(event) => setCanvasUnit(event.target.value as WindowLengthUnit)}><option value="in">inches</option><option value="ft">feet</option><option value="cm">centimeters</option><option value="mm">millimeters</option></select></label><span>{treatment.fullness === null ? 'Select fullness' : `${treatment.fullness}× fullness · gathered folds shown`}</span></figcaption>
                {result.dimensionsEntered ? <svg viewBox="0 0 560 340" role="img" aria-label={`${treatment.name} window with curtains drawn, at ${treatment.fullness ?? 1} times fullness`}>
                  <path d="M 58 48 H 502 M 58 48 V 306 M 502 48 V 306 M 58 306 H 502" fill="none" stroke="#42433d" strokeWidth="2" />
                  <rect x={frameX - 5} y={frameY - 5} width={frameWidth + 10} height={frameHeight + 10} fill="#343630" stroke="#aaa69d" strokeWidth="3" />
                  <rect x={frameX} y={frameY} width={frameWidth} height={frameHeight} fill="#9da9a0" />
                  <line x1={frameX + frameWidth / 2} y1={frameY} x2={frameX + frameWidth / 2} y2={frameY + frameHeight} stroke="#454840" strokeWidth="2" />
                  <line x1={previewX} y1={previewY - 14} x2={previewX + previewWidth} y2={previewY - 14} stroke="#aaa69d" strokeWidth="3" />
                  <circle cx={previewX - 5} cy={previewY - 14} r="5" fill="#d6a173" />
                  <circle cx={previewX + previewWidth + 5} cy={previewY - 14} r="5" fill="#d6a173" />
                  <rect x={previewX} y={previewY} width={previewWidth / 2} height={previewHeight} fill="#aa8061" />
                  <rect x={previewMiddle} y={previewY} width={previewWidth / 2} height={previewHeight} fill="#987253" />
                  {folds(previewX, previewMiddle)}
                  {folds(previewMiddle, previewX + previewWidth)}
                  <line x1={frameX} y1={frameY - 22} x2={frameX + frameWidth} y2={frameY - 22} stroke="#d6a173" strokeWidth="1" />
                  <text x="280" y={frameY - 27} fill="#e9e2d8" fontSize="11" textAnchor="middle">A · {dimension(fromWindowInches(treatment.width, canvasUnit))} {canvasUnit}</text>
                  <text x={frameX - 18} y={frameY + frameHeight / 2} fill="#e9e2d8" fontSize="11" textAnchor="middle" transform={`rotate(-90 ${frameX - 18} ${frameY + frameHeight / 2})`}>B · {dimension(fromWindowInches(treatment.height, canvasUnit))} {canvasUnit}</text>
                </svg> : <p className="window-preview-empty">Enter positive A and B measurements to show the scaled window and curtains.</p>}
                {result.dimensionsEntered && <p>Front view · fabric spans D and hangs to drop E; extra fullness is visualized as more gathered folds.</p>}
              </figure>
              <section className="window-computation" aria-label={`${treatment.name} full calculation`}>
                <h3>Full calculation · {treatment.name || `Window ${index + 1}`}</h3>
                <p>A (window width) = {dimension(fromWindowInches(treatment.width, treatment.widthUnit ?? 'in'))} {treatment.widthUnit ?? 'in'} = {dimension(treatment.width)} in</p>
                <p>B (window height) = {dimension(fromWindowInches(treatment.height, treatment.heightUnit ?? 'in'))} {treatment.heightUnit ?? 'in'} = {dimension(treatment.height)} in</p>
                <p>Side allowance = {dimension(treatment.sideAllowance)} in on each side</p>
                <p>C1 (top extra) = {dimension(treatment.topExtra)} in; C2 (bottom extra) = {dimension(treatment.bottomExtra)} in</p>
                <p>D (horizontal coverage) = A + 2 × side allowance = {dimension(treatment.width)} + 2 × {dimension(treatment.sideAllowance)} = {dimension(result.horizontalCoverage)} in</p>
                <p>E (fabric drop) = B + C1 + C2 + 12 in = {dimension(treatment.height)} + {dimension(treatment.topExtra)} + {dimension(treatment.bottomExtra)} + 12 = {dimension(result.fabricDrop)} in</p>
                <p>X (fullness multiplier) = {treatment.fullness === null ? 'not selected' : `${treatment.fullness}×`}</p>
                {!result.dimensionsEntered && <p>Enter a positive window width and height to calculate fabric yardage and cost.</p>}
                {result.dimensionsEntered && !result.calculationReady && <p>Select the fabric width and fullness to calculate yardage and cost.</p>}
                {result.calculationReady && <p>Fabric rule: {result.usesAreaFormula ? `area formula for ${treatment.fabricWidth}-inch fabric` : '110-inch fabric fits the drop, so use horizontal yardage'}.</p>}
                {result.calculationReady && <p>Y (yards needed) = {result.usesAreaFormula
                  ? `D × X × E ÷ (${fabricWidth} × 36) = ${dimension(result.horizontalCoverage)} × ${fullness} × ${dimension(result.fabricDrop)} ÷ ${fabricWidth * 36} = ${result.yards.toFixed(6)} yd`
                  : `D × X ÷ 36 = ${dimension(result.horizontalCoverage)} × ${fullness} ÷ 36 = ${result.yards.toFixed(6)} yd`}</p>}
                {result.calculationReady && <><p>Price per yard = {formatMoney(treatment.pricePerYard)} / yd</p>
                  <p>Total cost = yards needed × price per yard = {result.yards.toFixed(6)} × {formatMoney(treatment.pricePerYard)} = {formatMoney(result.cost)}</p></>}
              </section>
              <div className="window-cost-result"><span>Estimated fabric cost · {result.yards.toFixed(2)} yd</span><strong>{formatMoney(result.cost)}</strong></div>
            </article>
          )
        })}</div>}
      <div className="window-total"><span>Total window-treatment cost</span><strong>{formatMoney(total)}</strong></div>
    </section>
  )
}
