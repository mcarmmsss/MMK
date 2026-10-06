export type WindowTreatmentItem = {
  id: string
  name: string
  width: number
  widthUnit: WindowLengthUnit
  height: number
  heightUnit: WindowLengthUnit
  sideAllowance: number
  topExtra: number
  bottomExtra: number
  fabricWidth: 60 | 110 | null
  fullness: 1 | 2 | 2.4 | 2.6 | 3 | null
  pricePerYard: number
}

export type WindowLengthUnit = 'in' | 'ft' | 'cm' | 'mm'

const inchesPerUnit: Record<WindowLengthUnit, number> = { in: 1, ft: 12, cm: 1 / 2.54, mm: 1 / 25.4 }

export function fromWindowInches(value: number, unit: WindowLengthUnit) {
  return value / inchesPerUnit[unit]
}

export function toWindowInches(value: number, unit: WindowLengthUnit) {
  return value * inchesPerUnit[unit]
}

export function createWindowTreatment(name: string): WindowTreatmentItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    width: 0,
    widthUnit: 'in',
    height: 0,
    heightUnit: 'in',
    sideAllowance: 0,
    topExtra: 0,
    bottomExtra: 0,
    fabricWidth: null,
    fullness: null,
    pricePerYard: 0,
  }
}

export function calculateWindowTreatment(treatment: WindowTreatmentItem) {
  const horizontalCoverage = treatment.width + 2 * treatment.sideAllowance
  const fabricDrop = treatment.height + treatment.topExtra + treatment.bottomExtra + 12
  const dimensionsEntered = treatment.width > 0 && treatment.height > 0
  const fabricWidth = treatment.fabricWidth
  const fullness = treatment.fullness
  const calculationReady = dimensionsEntered && fabricWidth !== null && fullness !== null
  const usesAreaFormula = fabricWidth === 60 || (fabricWidth === 110 && fabricDrop > 110)
  let yards = 0
  if (dimensionsEntered && fabricWidth !== null && fullness !== null) {
    yards = usesAreaFormula
      ? horizontalCoverage * fullness * fabricDrop / (fabricWidth * 36)
      : horizontalCoverage * fullness / 36
  }
  return {
    horizontalCoverage,
    fabricDrop,
    dimensionsEntered,
    calculationReady,
    usesAreaFormula,
    yards,
    cost: yards * treatment.pricePerYard,
  }
}
