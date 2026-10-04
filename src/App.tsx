import { useEffect, useRef, useState } from 'react'
import addIcon from '../SVG/Add_ring_fill.svg'
import moneyIcon from '../SVG/philippine-peso.svg'
import moveIcon from '../SVG/move.svg'
import packageIcon from '../SVG/package.svg'
import percentIcon from '../SVG/Percent.svg'
import rotateIcon from '../SVG/rotate.svg'
import trashIcon from '../SVG/Trash.svg'
import downloadIcon from '../SVG/Download_circle_fill.svg'
import viewIcon from '../SVG/View.svg'
import hideIcon from '../SVG/View_hide.svg'
import Calculator from './Calculator'
import { evaluateArithmeticExpression } from './mathExpression'
import './App.css'

type Unit = 'ft' | 'in' | 'cm' | 'mm'
type PaintSource = 'outline' | 'manual'
type AreaUnit = 'm2' | 'ft2'
type PaintVolume = 'litres' | 'gallons'
type TileMode = 'layout' | 'simple'
type TileLayout = 'straight' | 'running-bond' | 'diagonal' | 'herringbone'
type BondOffsetMode = 'half' | 'third' | 'custom'
type Side = 'north' | 'east' | 'south' | 'west'
type Alignment = 'start' | 'center' | 'end'
type Rect = { id: number; x: number; y: number; width: number; height: number }
type DragState = { id: number; origin: Rect; pointer: { x: number; y: number }; draft: Rect }
type TileRowCount = { row: number; full: number; cut: number }
type TileCut = { row: number; column: number; tileX: number; tileY: number; tileWidth: number; tileHeight: number; x: number; y: number; width: number; height: number; profile?: Point[] }
type TileCutPlan = { row: number; column: number; stockTile: number; sourceWidth: number; sourceHeight: number; sourceIsFull: boolean; remainders: Array<{ width: number; height: number }> }
type TilePieceCount = { total: number; full: number; cut: number; cutArea: number; cuts: TileCut[]; rows: TileRowCount[]; approximate: boolean }
type Opening = { id: number; count: number; width: number; height: number }
type PaintSettings = { source: PaintSource; manualArea: number; manualUnit: AreaUnit; wallHeight: number; openings: Opening[]; openingArea: number; openingAreaUnit: AreaUnit; coats: number; volume: PaintVolume; unitPrice: number }
type TileCalculation = { mode: TileMode; layout: TileLayout; bondOffsetMode: BondOffsetMode; customBondOffset: number; reuseCutTiles: boolean }
type TileSet = { id: string; name: string; width: number; height: number; rotated: boolean; wasteOn: boolean; wastePercent: number; priceOpen: boolean; priceMode: 'tile' | 'box'; unitPrice: number; tilesPerBox: number; boxContentMode: 'tiles' | 'area'; coveragePerBox: number; coverageUnit: AreaUnit }
type Area = { id: number; name: string; tileSetId: string; sections: Rect[]; paint: PaintSettings; tileCalculation: TileCalculation }
type Project = { id: string; name: string; areas: Area[]; tileSets: TileSet[] }
type ProjectBackup = { format: 'mmk-project-backup'; version: 1; projects: Project[] }

const unitScale: Record<Unit, number> = { ft: 12, in: 1, cm: 1 / 2.54, mm: 1 / 25.4 }
const unitNames: Record<Unit, string> = { ft: 'ft', in: 'in', cm: 'cm', mm: 'mm' }
const defaultUnit: Unit = 'cm'
const storageKey = 'area-planner-projects-v1'
const squareFeetInSquareMetre = 10.7639104167
const areaUnitLabels: Record<AreaUnit, string> = { m2: 'm²', ft2: 'ft²' }

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createTileSet(name = 'Tile set 1'): TileSet {
  return { id: createId(), name, width: 30 / 2.54, height: 30 / 2.54, rotated: false, wasteOn: false, wastePercent: 10, priceOpen: false, priceMode: 'tile', unitPrice: 0, tilesPerBox: 8, boxContentMode: 'tiles', coveragePerBox: 0.72, coverageUnit: 'm2' }
}

function createPaintSettings(): PaintSettings {
  return { source: 'outline', manualArea: 25, manualUnit: 'm2', wallHeight: 240 / 2.54, openings: [], openingArea: 0, openingAreaUnit: 'm2', coats: 1, volume: 'litres', unitPrice: 0 }
}

function createTileCalculation(): TileCalculation {
  return { mode: 'layout', layout: 'straight', bondOffsetMode: 'half', customBondOffset: 0.5, reuseCutTiles: false }
}

function createProject(name = 'Untitled project'): Project {
  const tileSet = createTileSet()
  return { id: createId(), name, areas: [{ id: 1, name: 'Area 1', tileSetId: tileSet.id, sections: [{ id: 1, x: 0, y: 0, width: 400 / 2.54, height: 300 / 2.54 }], paint: createPaintSettings(), tileCalculation: createTileCalculation() }], tileSets: [tileSet] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isProjectBackup(value: unknown): value is ProjectBackup {
  if (!isRecord(value) || value.format !== 'mmk-project-backup' || value.version !== 1 || !Array.isArray(value.projects) || value.projects.length === 0) return false
  return value.projects.every((project) => {
    if (!isRecord(project) || typeof project.id !== 'string' || typeof project.name !== 'string' || !Array.isArray(project.areas) || !project.areas.length || !Array.isArray(project.tileSets) || !project.tileSets.length) return false
    const tileSetIds = project.tileSets.map((tileSet) => isRecord(tileSet) && typeof tileSet.id === 'string' ? tileSet.id : '')
    if (tileSetIds.some((id) => !id) || new Set(tileSetIds).size !== tileSetIds.length) return false
    const validTileSets = project.tileSets.every((tileSet) => isRecord(tileSet) &&
      typeof tileSet.name === 'string' && isFiniteNumber(tileSet.width) && tileSet.width > 0 && isFiniteNumber(tileSet.height) && tileSet.height > 0 &&
      typeof tileSet.rotated === 'boolean' && typeof tileSet.wasteOn === 'boolean' && isFiniteNumber(tileSet.wastePercent) &&
      typeof tileSet.priceOpen === 'boolean' && (tileSet.priceMode === 'tile' || tileSet.priceMode === 'box') &&
      isFiniteNumber(tileSet.unitPrice) && isFiniteNumber(tileSet.tilesPerBox) && tileSet.tilesPerBox > 0 &&
      (tileSet.boxContentMode === undefined || tileSet.boxContentMode === 'tiles' || tileSet.boxContentMode === 'area') &&
      (tileSet.coveragePerBox === undefined || (isFiniteNumber(tileSet.coveragePerBox) && tileSet.coveragePerBox > 0)) &&
      (tileSet.coverageUnit === undefined || tileSet.coverageUnit === 'm2' || tileSet.coverageUnit === 'ft2'))
    if (!validTileSets) return false
    return project.areas.every((area) => {
      if (!isRecord(area) || !isFiniteNumber(area.id) || typeof area.name !== 'string' || typeof area.tileSetId !== 'string' || !tileSetIds.includes(area.tileSetId) || !Array.isArray(area.sections) || !area.sections.length) return false
      const validSections = area.sections.every((section) => isRecord(section) && isFiniteNumber(section.id) && isFiniteNumber(section.x) && isFiniteNumber(section.y) && isFiniteNumber(section.width) && section.width > 0 && isFiniteNumber(section.height) && section.height > 0)
      if (!validSections || !isRecord(area.paint) || !isRecord(area.tileCalculation)) return false
      const paint = area.paint
      const validPaint = (paint.source === 'outline' || paint.source === 'manual') && isFiniteNumber(paint.manualArea) &&
        (paint.manualUnit === 'm2' || paint.manualUnit === 'ft2') && isFiniteNumber(paint.wallHeight) && Array.isArray(paint.openings) &&
        paint.openings.every((opening) => isRecord(opening) && isFiniteNumber(opening.id) && isFiniteNumber(opening.count) && isFiniteNumber(opening.width) && isFiniteNumber(opening.height)) &&
        isFiniteNumber(paint.openingArea) && (paint.openingAreaUnit === 'm2' || paint.openingAreaUnit === 'ft2') &&
        isFiniteNumber(paint.coats) && (paint.volume === 'litres' || paint.volume === 'gallons') && isFiniteNumber(paint.unitPrice)
      const calculation = area.tileCalculation
      const validCalculation = (calculation.mode === 'layout' || calculation.mode === 'simple') &&
        (calculation.layout === 'straight' || calculation.layout === 'running-bond' || calculation.layout === 'diagonal' || calculation.layout === 'herringbone') &&
        (calculation.bondOffsetMode === 'half' || calculation.bondOffsetMode === 'third' || calculation.bondOffsetMode === 'custom') && isFiniteNumber(calculation.customBondOffset) &&
        (calculation.reuseCutTiles === undefined || typeof calculation.reuseCutTiles === 'boolean')
      return validPaint && validCalculation
    })
  })
}

function prepareImportedProject(project: Project): Project {
  const tileSetIds = new Map(project.tileSets.map((tileSet) => [tileSet.id, createId()]))
  return {
    ...project,
    id: createId(),
    tileSets: project.tileSets.map((tileSet) => ({ ...createTileSet(tileSet.name), ...tileSet, id: tileSetIds.get(tileSet.id)! })),
    areas: project.areas.map((area, areaIndex) => ({
      ...area,
      id: areaIndex + 1,
      tileSetId: tileSetIds.get(area.tileSetId)!,
      sections: area.sections.map((section, sectionIndex) => ({ ...section, id: sectionIndex + 1 })),
      paint: {
        ...createPaintSettings(),
        ...area.paint,
        openings: area.paint.openings.map((opening, openingIndex) => ({ ...opening, id: openingIndex + 1 })),
      },
      tileCalculation: { ...createTileCalculation(), ...area.tileCalculation },
    })),
  }
}

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
}

function NumericInput({ value, onValueChange, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value))
  }, [value])

  return <input
    {...props}
    ref={inputRef}
    type="text"
    inputMode="text"
    value={draft}
    onChange={(event) => {
      const next = event.target.value
      setDraft(next)
      const result = evaluateArithmeticExpression(next)
      if (next.trim() && result !== null) onValueChange(result)
    }}
    onBlur={() => {
      const result = evaluateArithmeticExpression(draft)
      if (draft.trim() && result !== null) onValueChange(result)
      setDraft(String(value))
    }}
  />
}

function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = stored ? JSON.parse(stored) as Project[] : []
    return parsed.length ? parsed.map((project) => ({
      ...project,
      tileSets: project.tileSets.map((tileSet) => ({ ...createTileSet(tileSet.name), ...tileSet })),
      areas: project.areas.map((area) => ({
        ...area,
        paint: { ...createPaintSettings(), ...area.paint },
        tileCalculation: { ...createTileCalculation(), ...area.tileCalculation },
      })),
    })) : [createProject()]
  } catch {
    return [createProject()]
  }
}

function toInches(value: number, unit: Unit) {
  return value * unitScale[unit]
}

function fromInches(value: number, unit: Unit) {
  return value / unitScale[unit]
}

function displayLength(value: number, unit: Unit) {
  return Number(fromInches(value, unit).toFixed(2)).toString()
}

function areaToSquareMetres(value: number, unit: AreaUnit) {
  return unit === 'm2' ? value : value / squareFeetInSquareMetre
}

function areaFromSquareMetres(value: number, unit: AreaUnit) {
  return unit === 'm2' ? value : value * squareFeetInSquareMetre
}

function outlinePerimeter(rects: Rect[]) {
  const sectionPerimeters = rects.reduce((total, rect) => total + 2 * (rect.width + rect.height), 0)
  let sharedEdges = 0
  rects.forEach((rect, index) => {
    rects.slice(index + 1).forEach((other) => {
      if (Math.abs(rect.x + rect.width - other.x) < 0.001 || Math.abs(other.x + other.width - rect.x) < 0.001) {
        sharedEdges += Math.max(0, Math.min(rect.y + rect.height, other.y + other.height) - Math.max(rect.y, other.y))
      }
      if (Math.abs(rect.y + rect.height - other.y) < 0.001 || Math.abs(other.y + other.height - rect.y) < 0.001) {
        sharedEdges += Math.max(0, Math.min(rect.x + rect.width, other.x + other.width) - Math.max(rect.x, other.x))
      }
    })
  })
  return sectionPerimeters - sharedEdges * 2
}

function calculatePaint(sections: Rect[], paint: PaintSettings) {
  const outlineArea = outlinePerimeter(sections) * 0.0254 * paint.wallHeight * 0.0254
  const countedOpenings = paint.openings.reduce((total, opening) => total + opening.count * opening.width * opening.height * 0.0254 ** 2, 0)
  const directOpeningArea = areaToSquareMetres(paint.openingArea, paint.openingAreaUnit)
  const grossArea = paint.source === 'outline' ? outlineArea : areaToSquareMetres(paint.manualArea, paint.manualUnit)
  const deductions = paint.source === 'outline' ? countedOpenings + directOpeningArea : 0
  const netArea = Math.max(0, grossArea - deductions)
  const coats = Math.max(1, paint.coats)
  const quantity = paint.volume === 'litres' ? netArea * coats * 4 / 25 : netArea * coats / 25
  return { outlineArea, countedOpenings, directOpeningArea, grossArea, deductions, netArea, coats, quantity, cost: quantity * paint.unitPrice }
}

function overlaps(first: Rect, second: Rect) {
  return first.x < second.x + second.width - 0.001 &&
    first.x + first.width > second.x + 0.001 &&
    first.y < second.y + second.height - 0.001 &&
    first.y + first.height > second.y + 0.001
}

function connected(rects: Rect[]) {
  if (rects.length < 2) return true
  const visited = new Set<number>([rects[0].id])
  const queue = [rects[0]]
  while (queue.length) {
    const current = queue.shift()!
    for (const candidate of rects) {
      const touchesVertical = Math.abs(current.x + current.width - candidate.x) < 0.001 ||
        Math.abs(candidate.x + candidate.width - current.x) < 0.001
      const verticalOverlap = Math.min(current.y + current.height, candidate.y + candidate.height) -
        Math.max(current.y, candidate.y) > 0.001
      const touchesHorizontal = Math.abs(current.y + current.height - candidate.y) < 0.001 ||
        Math.abs(candidate.y + candidate.height - current.y) < 0.001
      const horizontalOverlap = Math.min(current.x + current.width, candidate.x + candidate.width) -
        Math.max(current.x, candidate.x) > 0.001
      if (!visited.has(candidate.id) && ((touchesVertical && verticalOverlap) || (touchesHorizontal && horizontalOverlap))) {
        visited.add(candidate.id)
        queue.push(candidate)
      }
    }
  }
  return visited.size === rects.length
}

function areaInSquareInches(rects: Rect[]) {
  return rects.reduce((total, rect) => total + rect.width * rect.height, 0)
}

function getRectBounds(rects: Rect[]) {
  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

type Point = { x: number; y: number }

function countAxisAlignedTiles(rects: Rect[], tileWidth: number, tileHeight: number, offset: number): TilePieceCount {
  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))
  const firstRow = Math.floor(minY / tileHeight) - 1
  const lastRow = Math.ceil(maxY / tileHeight) + 1
  const pieces = new Map<string, boolean>()
  const rowCounts = new Map<number, { full: number; cut: number }>()
  const cuts: TileCut[] = []
  let cutArea = 0

  for (let row = firstRow; row < lastRow; row += 1) {
    const shift = row % 2 === 0 ? 0 : offset * tileWidth
    const firstColumn = Math.floor((minX - shift) / tileWidth) - 1
    const lastColumn = Math.ceil((maxX - shift) / tileWidth) + 1
    for (let column = firstColumn; column < lastColumn; column += 1) {
      const x = column * tileWidth + shift
      const y = row * tileHeight
      const fragments = rects.map((rect) => {
        const width = Math.max(0, Math.min(x + tileWidth, rect.x + rect.width) - Math.max(x, rect.x))
        const height = Math.max(0, Math.min(y + tileHeight, rect.y + rect.height) - Math.max(y, rect.y))
        return { x: Math.max(x, rect.x), y: Math.max(y, rect.y), width, height }
      }).filter((fragment) => fragment.width > 0.001 && fragment.height > 0.001)
      const covered = fragments.reduce((total, fragment) => total + fragment.width * fragment.height, 0)
      if (covered > 0.001) {
        const full = covered >= tileWidth * tileHeight - 0.001
        pieces.set(`${row}:${column}`, full)
        if (!full) {
          cutArea += covered
          fragments.forEach((fragment) => cuts.push({ row, column, tileX: x, tileY: y, tileWidth, tileHeight, ...fragment }))
        }
        const counts = rowCounts.get(row) ?? { full: 0, cut: 0 }
        counts[full ? 'full' : 'cut'] += 1
        rowCounts.set(row, counts)
      }
    }
  }

  const full = [...pieces.values()].filter(Boolean).length
  const total = pieces.size
  const rows = [...rowCounts].map(([row, counts]) => ({ row, ...counts })).sort((first, second) => first.row - second.row)
  return { total, full, cut: total - full, cutArea, cuts, rows, approximate: false }
}

function clipPolygon(polygon: Point[], edge: 'left' | 'right' | 'top' | 'bottom', bound: number) {
  const inside = (point: Point) => edge === 'left' ? point.x >= bound : edge === 'right' ? point.x <= bound : edge === 'top' ? point.y >= bound : point.y <= bound
  const intersection = (start: Point, end: Point): Point => {
    if (edge === 'left' || edge === 'right') {
      const ratio = (bound - start.x) / (end.x - start.x)
      return { x: bound, y: start.y + (end.y - start.y) * ratio }
    }
    const ratio = (bound - start.y) / (end.y - start.y)
    return { x: start.x + (end.x - start.x) * ratio, y: bound }
  }
  const output: Point[] = []
  let previous = polygon[polygon.length - 1]
  polygon.forEach((current) => {
    if (inside(current)) {
      if (!inside(previous)) output.push(intersection(previous, current))
      output.push(current)
    } else if (inside(previous)) output.push(intersection(previous, current))
    previous = current
  })
  return output
}

function clipPolygonToRect(polygon: Point[], rect: Rect) {
  return [
    ['left', rect.x],
    ['right', rect.x + rect.width],
    ['top', rect.y],
    ['bottom', rect.y + rect.height],
  ].reduce((result, [edge, bound]) => clipPolygon(result, edge as 'left' | 'right' | 'top' | 'bottom', bound as number), polygon)
}

function polygonArea(polygon: Point[]) {
  if (polygon.length < 3) return 0
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0)) / 2
}

function simplifyPolygon(polygon: Point[]) {
  const points = polygon.filter((point, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length]
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.001
  })
  if (points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 0.001) points.pop()
  let changed = true
  while (changed && points.length > 3) {
    changed = false
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[(index + points.length - 1) % points.length]
      const current = points[index]
      const next = points[(index + 1) % points.length]
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x)
      if (Math.abs(cross) < 0.001) {
        points.splice(index, 1)
        changed = true
        break
      }
    }
  }
  return points
}

function countDiagonalTiles(rects: Rect[], tileWidth: number, tileHeight: number): TilePieceCount {
  const angle = Math.PI / 4
  const rotate = (point: Point, direction: number): Point => ({
    x: point.x * Math.cos(direction) - point.y * Math.sin(direction),
    y: point.x * Math.sin(direction) + point.y * Math.cos(direction),
  })
  const corners = rects.flatMap((rect) => [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ]).map((point) => rotate(point, -angle))
  const minX = Math.min(...corners.map((point) => point.x))
  const minY = Math.min(...corners.map((point) => point.y))
  const maxX = Math.max(...corners.map((point) => point.x))
  const maxY = Math.max(...corners.map((point) => point.y))
  const pieces: boolean[] = []
  const rowCounts = new Map<number, { full: number; cut: number }>()
  const cuts: TileCut[] = []
  let cutArea = 0
  for (let row = Math.floor(minY / tileHeight) - 1; row < Math.ceil(maxY / tileHeight) + 1; row += 1) {
    for (let column = Math.floor(minX / tileWidth) - 1; column < Math.ceil(maxX / tileWidth) + 1; column += 1) {
      const polygon = [
        { x: column * tileWidth, y: row * tileHeight },
        { x: (column + 1) * tileWidth, y: row * tileHeight },
        { x: (column + 1) * tileWidth, y: (row + 1) * tileHeight },
        { x: column * tileWidth, y: (row + 1) * tileHeight },
      ].map((point) => rotate(point, angle))
      const fragments = rects.map((rect) => clipPolygonToRect(polygon, rect)).filter((fragment) => polygonArea(fragment) > 0.001)
      const covered = fragments.reduce((total, fragment) => total + polygonArea(fragment), 0)
      if (covered > 0.001) {
        const full = covered >= tileWidth * tileHeight - 0.001
        pieces.push(full)
        if (!full) {
          cutArea += covered
          fragments.forEach((fragment) => {
            const profile = simplifyPolygon(fragment.map((point) => {
              const local = rotate(point, -angle)
              return { x: local.x - column * tileWidth, y: local.y - row * tileHeight }
            }))
            cuts.push({ row, column, tileX: column * tileWidth, tileY: row * tileHeight, tileWidth, tileHeight, x: 0, y: 0, width: tileWidth, height: tileHeight, profile })
          })
        }
        const counts = rowCounts.get(row) ?? { full: 0, cut: 0 }
        counts[full ? 'full' : 'cut'] += 1
        rowCounts.set(row, counts)
      }
    }
  }
  const full = pieces.filter(Boolean).length
  const rows = [...rowCounts].map(([row, counts]) => ({ row, ...counts })).sort((first, second) => first.row - second.row)
  return { total: pieces.length, full, cut: pieces.length - full, cutArea, cuts, rows, approximate: false }
}

function countHerringboneTiles(rects: Rect[], tileWidth: number, tileHeight: number): TilePieceCount {
  const shortSide = Math.min(tileWidth, tileHeight)
  const longSide = Math.max(tileWidth, tileHeight)
  if (Math.abs(longSide / shortSide - 2) > 0.02) {
    return { ...countAxisAlignedTiles(rects, tileWidth, tileHeight, 0.5), approximate: true }
  }

  const unit = shortSide
  const period = unit * 4
  const placements = [
    { x: 0, y: 0, width: unit * 2, height: unit },
    { x: unit * 2, y: 0, width: unit * 2, height: unit },
    { x: unit, y: unit, width: unit * 2, height: unit },
    { x: unit, y: unit * 2, width: unit * 2, height: unit },
    { x: 0, y: unit * 3, width: unit * 2, height: unit },
    { x: unit * 2, y: unit * 3, width: unit * 2, height: unit },
    { x: 0, y: unit, width: unit, height: unit * 2 },
    { x: unit * 3, y: unit, width: unit, height: unit * 2 },
  ]
  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))
  const pieces: boolean[] = []
  const rowCounts = new Map<number, { full: number; cut: number }>()
  const cuts: TileCut[] = []
  let cutArea = 0

  for (let blockY = Math.floor(minY / period) - 1; blockY < Math.ceil(maxY / period) + 1; blockY += 1) {
    for (let blockX = Math.floor(minX / period) - 1; blockX < Math.ceil(maxX / period) + 1; blockX += 1) {
      placements.forEach((placement) => {
        const x = blockX * period + placement.x
        const y = blockY * period + placement.y
        const fragments = rects.map((rect) => {
          const width = Math.max(0, Math.min(x + placement.width, rect.x + rect.width) - Math.max(x, rect.x))
          const height = Math.max(0, Math.min(y + placement.height, rect.y + rect.height) - Math.max(y, rect.y))
          return { x: Math.max(x, rect.x), y: Math.max(y, rect.y), width, height }
        }).filter((fragment) => fragment.width > 0.001 && fragment.height > 0.001)
        const covered = fragments.reduce((total, fragment) => total + fragment.width * fragment.height, 0)
        if (covered > 0.001) {
          const full = covered >= placement.width * placement.height - 0.001
          pieces.push(full)
          if (!full) {
            cutArea += covered
            fragments.forEach((fragment) => cuts.push({ row: blockY * 4 + placement.y / unit, column: blockX * 4 + placement.x / unit, tileX: x, tileY: y, tileWidth: placement.width, tileHeight: placement.height, ...fragment }))
          }
          const row = blockY * 4 + placement.y / unit
          const counts = rowCounts.get(row) ?? { full: 0, cut: 0 }
          counts[full ? 'full' : 'cut'] += 1
          rowCounts.set(row, counts)
        }
      })
    }
  }
  const full = pieces.filter(Boolean).length
  const rows = [...rowCounts].map(([row, counts]) => ({ row, ...counts })).sort((first, second) => first.row - second.row)
  return { total: pieces.length, full, cut: pieces.length - full, cutArea, cuts, rows, approximate: false }
}

function countPatternTilePieces(rects: Rect[], tileWidth: number, tileHeight: number, layout: TileLayout, offset: number): TilePieceCount {
  if (layout === 'diagonal') return countDiagonalTiles(rects, tileWidth, tileHeight)
  if (layout === 'running-bond') return countAxisAlignedTiles(rects, tileWidth, tileHeight, offset)
  if (layout === 'herringbone') return countHerringboneTiles(rects, tileWidth, tileHeight)
  return countAxisAlignedTiles(rects, tileWidth, tileHeight, 0)
}

function getBondOffset(calculation: TileCalculation) {
  if (calculation.bondOffsetMode === 'half') return 0.5
  if (calculation.bondOffsetMode === 'third') return 1 / 3
  return Math.min(0.95, Math.max(0.05, calculation.customBondOffset))
}

function getTileLayoutName(calculation: TileCalculation) {
  return calculation.layout === 'running-bond'
    ? `Running bond · ${Math.round(getBondOffset(calculation) * 100)}% offset`
    : calculation.layout.replace('-', ' ')
}

function getTilePattern(tileWidth: number, tileHeight: number, calculation: TileCalculation) {
  const bondOffset = getBondOffset(calculation)
  const bondColumns = calculation.bondOffsetMode === 'half' ? 2 : calculation.bondOffsetMode === 'third' ? 3 : 100
  if (calculation.layout === 'running-bond') {
    const width = tileWidth * bondColumns
    const path = Array.from({ length: 2 }, (_, row) => {
      const offset = row === 0 ? 0 : bondOffset * tileWidth
      const verticals = Array.from({ length: bondColumns + 2 }, (_, column) => `M ${column * tileWidth + offset} ${row * tileHeight} V ${(row + 1) * tileHeight}`).join(' ')
      return `${verticals} M 0 ${(row + 1) * tileHeight} H ${width}`
    }).join(' ')
    return { width, height: tileHeight * 2, path, transform: undefined }
  }
  if (calculation.layout === 'herringbone') {
    const unit = Math.min(tileWidth, tileHeight)
    const placements = [
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 2, y: 0, width: 2, height: 1 },
      { x: 1, y: 1, width: 2, height: 1 },
      { x: 1, y: 2, width: 2, height: 1 },
      { x: 0, y: 3, width: 2, height: 1 },
      { x: 2, y: 3, width: 2, height: 1 },
      { x: 0, y: 1, width: 1, height: 2 },
      { x: 3, y: 1, width: 1, height: 2 },
    ]
    const path = placements.map((placement) => `M ${placement.x * unit} ${placement.y * unit} h ${placement.width * unit} v ${placement.height * unit} h ${-placement.width * unit} Z`).join(' ')
    return { width: unit * 4, height: unit * 4, path, transform: undefined }
  }
  return {
    width: tileWidth,
    height: tileHeight,
    path: `M ${tileWidth} 0 L 0 0 0 ${tileHeight}`,
    transform: calculation.layout === 'diagonal' ? 'rotate(45)' : undefined,
  }
}

function summarizeTileCuts(cuts: TileCut[], unit: Unit, cutPlan: TileCutPlan[] = []) {
  const groups = new Map<string, { quantity: number; piece: string; instruction: string; positions: string[] }>()
  const format = (value: number) => displayLength(value, unit)
  cuts.forEach((cut) => {
    const plan = cutPlan.find((entry) => entry.row === cut.row && entry.column === cut.column)
    const profile = cut.profile?.map((point) => `${format(point.x)}, ${format(point.y)}`)
    const trims = [
      ['left', cut.x - cut.tileX],
      ['right', cut.tileX + cut.tileWidth - cut.x - cut.width],
      ['top', cut.y - cut.tileY],
      ['bottom', cut.tileY + cut.tileHeight - cut.y - cut.height],
    ].filter(([, amount]) => (amount as number) > 0.001).map(([side, amount]) => `${side} ${format(amount as number)} ${unit}`)
    const piece = profile
      ? `Diagonal profile: ${profile.map((point, index) => `P${index + 1} (${point})`).join(' · ')} ${unit}`
      : `${format(cut.width)} × ${format(cut.height)} ${unit}`
    const offcuts = profile ? [] : [
      { width: cut.x - cut.tileX, height: cut.tileHeight },
      { width: cut.tileX + cut.tileWidth - cut.x - cut.width, height: cut.tileHeight },
      { width: cut.width, height: cut.y - cut.tileY },
      { width: cut.width, height: cut.tileY + cut.tileHeight - cut.y - cut.height },
    ].filter((remainder) => remainder.width > 0.001 && remainder.height > 0.001)
    const instruction = plan
      ? `Place at the top-left of ${plan.sourceIsFull ? `full cut-stock tile ${plan.stockTile}` : `tile ${plan.stockTile}'s ${format(plan.sourceWidth)} × ${format(plan.sourceHeight)} offcut`}, then cut ${format(cut.width)} × ${format(cut.height)} ${unit}.${plan.remainders.length ? ` New remainders: ${plan.remainders.map((remainder) => `${format(remainder.width)} × ${format(remainder.height)} ${unit}`).join(' + ')}.` : ' No reusable remainder.'}`
      : profile
      ? 'Mark the profile points from the tile origin and cut between them; remaining profile is irregular.'
      : `${trims.length ? `Trim ${trims.join('; ')} from the tile.` : 'Cut to the listed size.'}${offcuts.length ? ` Remainders: ${offcuts.map((remainder) => `${format(remainder.width)} × ${format(remainder.height)} ${unit}`).join(' + ')}.` : ''}`
    const key = profile
      ? `profile:${profile.join('|')}`
      : `rect:${[cut.width, cut.height, ...trims, plan?.stockTile ?? 0, plan?.sourceWidth ?? 0, plan?.sourceHeight ?? 0, ...(plan?.remainders.flatMap((remainder) => [remainder.width, remainder.height]) ?? [])].map((value) => typeof value === 'number' ? format(value) : value).join('|')}`
    const group = groups.get(key) ?? { quantity: 0, piece, instruction, positions: [] }
    group.quantity += 1
    group.positions.push(`R${cut.row + 1}/C${cut.column + 1}`)
    groups.set(key, group)
  })
  return [...groups.values()]
}

function calculateRectangularCutReuse(layoutPieces: TilePieceCount, tileWidth: number, tileHeight: number) {
  const positionCounts = new Map<string, number>()
  layoutPieces.cuts.forEach((cut) => {
    const key = `${cut.row}:${cut.column}`
    positionCounts.set(key, (positionCounts.get(key) ?? 0) + 1)
  })
  if (layoutPieces.cuts.some((cut) => cut.profile) || layoutPieces.cuts.length !== layoutPieces.cut || [...positionCounts.values()].some((count) => count !== 1)) return null

  const remainders: Array<{ width: number; height: number; stockTile: number; isFullTile: boolean }> = []
  const plan: TileCutPlan[] = []
  let cutTiles = 0
  const cuts = [...layoutPieces.cuts].sort((first, second) => second.width * second.height - first.width * first.height)
  cuts.forEach((cut) => {
    if (cut.width > tileWidth + 0.001 || cut.height > tileHeight + 0.001) return
    let bestIndex = -1
    let bestWaste = Number.POSITIVE_INFINITY
    remainders.forEach((remainder, index) => {
      if (remainder.width + 0.001 < cut.width || remainder.height + 0.001 < cut.height) return
      const waste = remainder.width * remainder.height - cut.width * cut.height
      if (waste < bestWaste) {
        bestIndex = index
        bestWaste = waste
      }
    })
    if (bestIndex < 0) {
      cutTiles += 1
      remainders.push({ width: tileWidth, height: tileHeight, stockTile: cutTiles, isFullTile: true })
      bestIndex = remainders.length - 1
    }
    const remainder = remainders.splice(bestIndex, 1)[0]
    const rightWidth = remainder.width - cut.width
    const bottomHeight = remainder.height - cut.height
    const newRemainders = [
      { width: rightWidth, height: remainder.height },
      { width: cut.width, height: bottomHeight },
    ].filter((offcut) => offcut.width > 0.001 && offcut.height > 0.001)
    plan.push({ row: cut.row, column: cut.column, stockTile: remainder.stockTile, sourceWidth: remainder.width, sourceHeight: remainder.height, sourceIsFull: remainder.isFullTile, remainders: newRemainders })
    newRemainders.forEach((offcut) => remainders.push({ ...offcut, stockTile: remainder.stockTile, isFullTile: false }))
  })
  if (plan.length !== cuts.length) return null
  return { baseTiles: layoutPieces.full + cutTiles, savings: Math.max(0, layoutPieces.cut - cutTiles), plan }
}

function calculateTileEstimate(area: Area, tileSet: TileSet) {
  const tileWidth = tileSet.rotated ? tileSet.height : tileSet.width
  const tileHeight = tileSet.rotated ? tileSet.width : tileSet.height
  const areaRatio = areaInSquareInches(area.sections) / (tileWidth * tileHeight)
  const layoutPieces = countPatternTilePieces(area.sections, tileWidth, tileHeight, area.tileCalculation.layout, getBondOffset(area.tileCalculation))
  const cutReuse = calculateRectangularCutReuse(layoutPieces, tileWidth, tileHeight)
  const reuseSupported = cutReuse !== null
  const reusedBaseTiles = cutReuse?.baseTiles ?? layoutPieces.total
  const reuseSavings = cutReuse?.savings ?? 0
  const cutPlan = cutReuse?.plan ?? []
  const baseTiles = area.tileCalculation.mode === 'simple' ? areaRatio : area.tileCalculation.reuseCutTiles && reuseSupported ? reusedBaseTiles : layoutPieces.total
  const wastePercent = tileSet.wasteOn ? tileSet.wastePercent : 0
  const materialTiles = area.tileCalculation.mode === 'simple'
    ? Math.ceil(areaRatio * (1 + wastePercent / 100))
    : baseTiles + Math.ceil(baseTiles * wastePercent / 100)
  const wasteTiles = area.tileCalculation.mode === 'simple'
    ? areaRatio * wastePercent / 100
    : materialTiles - baseTiles
  return { originalTileWidth: tileSet.width, originalTileHeight: tileSet.height, rotated: tileSet.rotated, tileWidth, tileHeight, areaRatio, layoutPieces, reusedBaseTiles, reuseSavings, reuseSupported, cutPlan, baseTiles, wastePercent, wasteTiles, materialTiles }
}

function calculateBoxCount(tileCount: number, tileSet: TileSet) {
  if (tileSet.boxContentMode === 'area') {
    const requiredArea = tileCount * tileSet.width * tileSet.height * 0.00064516
    const coveragePerBox = areaToSquareMetres(tileSet.coveragePerBox, tileSet.coverageUnit)
    return Math.ceil(requiredArea / Math.max(0.000001, coveragePerBox))
  }
  return Math.ceil(tileCount / Math.max(1, tileSet.tilesPerBox))
}

function App() {
  const [unit, setUnit] = useState<Unit>(defaultUnit)
  const [activeView, setActiveView] = useState<'tiles' | 'paint' | 'formulas'>('tiles')
  const [showTileComputation, setShowTileComputation] = useState(true)
  const [showPaintComputation, setShowPaintComputation] = useState(true)
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem(`${storageKey}-active`) ?? '')
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const [activeAreaId, setActiveAreaId] = useState(1)
  const selectedArea = activeProject.areas.find((area) => area.id === activeAreaId) ?? activeProject.areas[0]
  const assignedTileSet = activeProject.tileSets.find((tileSet) => tileSet.id === selectedArea.tileSetId) ?? activeProject.tileSets[0]
  const [editingTileSetId, setEditingTileSetId] = useState('')
  const editingTileSet = activeProject.tileSets.find((tileSet) => tileSet.id === editingTileSetId) ?? assignedTileSet
  const sections = selectedArea.sections
  const [selectedId, setSelectedId] = useState(1)
  const [attachSide, setAttachSide] = useState<Side>('east')
  const [alignment, setAlignment] = useState<Alignment>('start')
  const [newWidth, setNewWidth] = useState(200)
  const [newHeight, setNewHeight] = useState(120)
  const [notice, setNotice] = useState('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(true)
  const [showPlanInReceipt, setShowPlanInReceipt] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(projects))
    localStorage.setItem(`${storageKey}-active`, activeProject.id)
  }, [projects, activeProject.id])

  const selected = sections.find((section) => section.id === selectedId) ?? sections[0]
  const tileW = assignedTileSet.rotated ? assignedTileSet.height : assignedTileSet.width
  const tileH = assignedTileSet.rotated ? assignedTileSet.width : assignedTileSet.height
  const squareUnitScale = unitScale[unit] ** 2
  const editingWidth = editingTileSet.rotated ? editingTileSet.height : editingTileSet.width
  const editingHeight = editingTileSet.rotated ? editingTileSet.width : editingTileSet.height
  const visualSections = drag ? sections.map((section) => section.id === drag.id ? drag.draft : section) : sections
  const tileEstimate = calculateTileEstimate(selectedArea, assignedTileSet)
  const selectedCutSummaries = summarizeTileCuts(tileEstimate.layoutPieces.cuts, unit, selectedArea.tileCalculation.reuseCutTiles ? tileEstimate.cutPlan : [])
  const baseTiles = tileEstimate.baseTiles
  const wasteTiles = tileEstimate.wasteTiles
  const materialTiles = tileEstimate.materialTiles
  const boxCount = calculateBoxCount(materialTiles, assignedTileSet)
  const priceTotal = assignedTileSet.priceMode === 'tile' ? materialTiles * assignedTileSet.unitPrice : boxCount * assignedTileSet.unitPrice
  const paintEstimate = calculatePaint(sections, selectedArea.paint)
  const receiptItems = activeProject.areas.map((area) => {
    const tileSet = activeProject.tileSets.find((entry) => entry.id === area.tileSetId) ?? assignedTileSet
    const estimate = calculateTileEstimate(area, tileSet)
    const tileWidth = tileSet.rotated ? tileSet.height : tileSet.width
    const tileHeight = tileSet.rotated ? tileSet.width : tileSet.height
    return {
      area,
      tileSet,
      tiles: estimate.baseTiles,
      base: estimate.baseTiles,
      waste: estimate.wasteTiles,
      wastePercent: tileSet.wasteOn ? tileSet.wastePercent : 0,
      total: estimate.materialTiles,
      layoutPieces: estimate.layoutPieces,
      areaRatio: estimate.areaRatio,
      tileWidth,
      tileHeight,
      bounds: getRectBounds(area.sections),
      pattern: getTilePattern(tileWidth, tileHeight, area.tileCalculation),
      cutSummaries: summarizeTileCuts(estimate.layoutPieces.cuts, unit, area.tileCalculation.reuseCutTiles ? estimate.cutPlan : []),
    }
  })
  const receiptPaintItems = activeProject.areas.map((area) => ({ area, ...calculatePaint(area.sections, area.paint) }))
  const receiptTileSets = activeProject.tileSets.map((tileSet) => {
    const items = receiptItems.filter((item) => item.tileSet.id === tileSet.id)
    const total = items.reduce((sum, item) => sum + item.total, 0)
    const base = items.reduce((sum, item) => sum + item.base, 0)
    const waste = items.reduce((sum, item) => sum + item.waste, 0)
    const boxes = calculateBoxCount(total, tileSet)
    const amount = tileSet.priceMode === 'tile' ? total * tileSet.unitPrice : boxes * tileSet.unitPrice
    return { tileSet, base, waste, wastePercent: tileSet.wasteOn ? tileSet.wastePercent : 0, total, boxes, amount }
  }).filter((item) => item.total > 0)
  const receiptCutItems = receiptItems.flatMap((item) => item.cutSummaries.map((cut, index) => ({ ...cut, area: item.area, tileSet: item.tileSet, index })))
  const receiptTileTotal = receiptTileSets.reduce((sum, item) => sum + item.amount, 0)
  const receiptPaintTotal = receiptPaintItems.reduce((sum, item) => sum + item.cost, 0)
  const receiptTotal = receiptTileTotal + receiptPaintTotal
  const bondOffset = getBondOffset(selectedArea.tileCalculation)
  const bondPatternColumns = selectedArea.tileCalculation.bondOffsetMode === 'half' ? 2 : selectedArea.tileCalculation.bondOffsetMode === 'third' ? 3 : 100
  const herringboneUnit = Math.min(tileW, tileH)
  const herringbonePlacements = [
    { x: 0, y: 0, width: 2, height: 1 },
    { x: 2, y: 0, width: 2, height: 1 },
    { x: 1, y: 1, width: 2, height: 1 },
    { x: 1, y: 2, width: 2, height: 1 },
    { x: 0, y: 3, width: 2, height: 1 },
    { x: 2, y: 3, width: 2, height: 1 },
    { x: 0, y: 1, width: 1, height: 2 },
    { x: 3, y: 1, width: 1, height: 2 },
  ]
  const tilePatternWidth = selectedArea.tileCalculation.layout === 'running-bond' ? tileW * bondPatternColumns : selectedArea.tileCalculation.layout === 'herringbone' ? herringboneUnit * 4 : tileW
  const tilePatternHeight = selectedArea.tileCalculation.layout === 'running-bond' ? tileH * 2 : selectedArea.tileCalculation.layout === 'herringbone' ? herringboneUnit * 4 : tileH
  const tilePatternPath = selectedArea.tileCalculation.layout === 'running-bond'
    ? Array.from({ length: 2 }, (_, row) => {
      const offset = row === 0 ? 0 : bondOffset * tileW
      const verticals = Array.from({ length: bondPatternColumns + 2 }, (_, column) => `M ${column * tileW + offset} ${row * tileH} V ${(row + 1) * tileH}`).join(' ')
      return `${verticals} M 0 ${(row + 1) * tileH} H ${tilePatternWidth}`
    }).join(' ')
    : selectedArea.tileCalculation.layout === 'herringbone'
      ? herringbonePlacements.map((placement) => `M ${placement.x * herringboneUnit} ${placement.y * herringboneUnit} h ${placement.width * herringboneUnit} v ${placement.height * herringboneUnit} h ${-placement.width * herringboneUnit} Z`).join(' ')
      : `M ${tilePatternWidth} 0 L 0 0 0 ${tilePatternHeight}`

  const minX = Math.min(...sections.map((section) => section.x))
  const minY = Math.min(...sections.map((section) => section.y))
  const maxX = Math.max(...sections.map((section) => section.x + section.width))
  const maxY = Math.max(...sections.map((section) => section.y + section.height))
  const padding = Math.max(tileW, tileH) * 0.8
  const bounds = { minX: minX - padding, minY: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2, roomX: minX, roomY: minY, roomWidth: maxX - minX, roomHeight: maxY - minY }

  function updateProject(update: (project: Project) => Project) {
    setProjects((current) => current.map((project) => project.id === activeProject.id ? update(project) : project))
  }

  function updateArea(id: number, update: (area: Area) => Area) {
    updateProject((project) => ({ ...project, areas: project.areas.map((area) => area.id === id ? update(area) : area) }))
  }

  function updateTileSet(id: string, update: (tileSet: TileSet) => TileSet) {
    updateProject((project) => ({ ...project, tileSets: project.tileSets.map((tileSet) => tileSet.id === id ? update(tileSet) : tileSet) }))
  }

  function updateEditingTileSet(update: (tileSet: TileSet) => TileSet) {
    updateTileSet(editingTileSet.id, update)
  }

  function updateAssignedTileSet(update: (tileSet: TileSet) => TileSet) {
    updateTileSet(assignedTileSet.id, update)
  }

  function updatePaint(update: (paint: PaintSettings) => PaintSettings) {
    updateArea(selectedArea.id, (area) => ({ ...area, paint: update(area.paint) }))
  }

  function updateTileCalculation(update: (calculation: TileCalculation) => TileCalculation) {
    updateArea(selectedArea.id, (area) => ({ ...area, tileCalculation: update(area.tileCalculation) }))
  }

  function addProject() {
    const project = createProject(`Untitled project ${projects.length + 1}`)
    setProjects((current) => [...current, project])
    setActiveProjectId(project.id)
    setActiveAreaId(project.areas[0].id)
    setEditingTileSetId(project.tileSets[0].id)
    setSelectedId(project.areas[0].sections[0].id)
    setNotice('')
  }

  function selectProject(id: string) {
    const project = projects.find((entry) => entry.id === id)
    if (!project) return
    setActiveProjectId(project.id)
    setActiveAreaId(project.areas[0].id)
    setEditingTileSetId(project.tileSets[0].id)
    setSelectedId(project.areas[0].sections[0].id)
    setNotice('')
  }

  function deleteProject() {
    if (projects.length <= 1 || !window.confirm(`Delete "${activeProject.name || 'Untitled project'}"? This cannot be undone.`)) return
    const nextProjects = projects.filter((project) => project.id !== activeProject.id)
    const nextProject = nextProjects[0]
    setProjects(nextProjects)
    setActiveProjectId(nextProject.id)
    setActiveAreaId(nextProject.areas[0].id)
    setEditingTileSetId(nextProject.tileSets[0].id)
    setSelectedId(nextProject.areas[0].sections[0].id)
    setNotice('')
  }

  function downloadBackup() {
    const backup: ProjectBackup = { format: 'mmk-project-backup', version: 1, projects }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mmk-projects-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isProjectBackup(parsed)) {
        setActiveView('tiles')
        setNotice('That file is not a supported MMK project backup.')
        return
      }
      const imported = parsed.projects.map(prepareImportedProject)
      setProjects((current) => [...current, ...imported])
      setActiveProjectId(imported[0].id)
      setActiveAreaId(imported[0].areas[0].id)
      setEditingTileSetId(imported[0].tileSets[0].id)
      setSelectedId(imported[0].areas[0].sections[0].id)
      setActiveView('tiles')
      setNotice(`Imported ${imported.length} ${imported.length === 1 ? 'project' : 'projects'}.`)
    } catch {
      setActiveView('tiles')
      setNotice('Could not read that file. Choose a valid MMK project backup.')
    }
  }

  function addArea() {
    const area = { id: Math.max(...activeProject.areas.map((entry) => entry.id)) + 1, name: `Area ${activeProject.areas.length + 1}`, tileSetId: assignedTileSet.id, sections: [{ id: 1, x: 0, y: 0, width: 144, height: 120 }], paint: createPaintSettings(), tileCalculation: createTileCalculation() }
    updateProject((project) => ({ ...project, areas: [...project.areas, area] }))
    setActiveAreaId(area.id)
    setSelectedId(area.sections[0].id)
    setNotice('')
  }

  function removeArea(id: number) {
    if (activeProject.areas.length <= 1) return
    const next = activeProject.areas.filter((area) => area.id !== id)
    updateProject((project) => ({ ...project, areas: next }))
    if (activeAreaId === id) {
      setActiveAreaId(next[0].id)
      setSelectedId(next[0].sections[0].id)
    }
    setNotice('')
  }

  function addTileSet() {
    const tileSet = createTileSet(`Tile set ${activeProject.tileSets.length + 1}`)
    updateProject((project) => ({ ...project, tileSets: [...project.tileSets, tileSet] }))
    setEditingTileSetId(tileSet.id)
  }

  function assignTileSet(areaId: number, id: string) {
    updateArea(areaId, (area) => ({ ...area, tileSetId: id }))
    const area = activeProject.areas.find((entry) => entry.id === areaId)
    if (area) {
      setActiveAreaId(area.id)
      setSelectedId(area.sections[0].id)
    }
  }

  function selectArea(area: Area) {
    setActiveAreaId(area.id)
    setSelectedId(area.sections[0].id)
    setNotice('')
  }

  function updateOpening(id: number, update: (opening: Opening) => Opening) {
    updatePaint((paint) => ({ ...paint, openings: paint.openings.map((opening) => opening.id === id ? update(opening) : opening) }))
  }

  function addOpening() {
    updatePaint((paint) => ({ ...paint, openings: [...paint.openings, { id: Math.max(0, ...paint.openings.map((opening) => opening.id)) + 1, count: 1, width: 90 / 2.54, height: 200 / 2.54 }] }))
  }

  function removeOpening(id: number) {
    updatePaint((paint) => ({ ...paint, openings: paint.openings.filter((opening) => opening.id !== id) }))
  }

  function addSection() {
    const width = toInches(newWidth, unit)
    const height = toInches(newHeight, unit)
    const factor = alignment === 'start' ? 0 : alignment === 'center' ? 0.5 : 1
    let x: number
    let y: number
    if (attachSide === 'east' || attachSide === 'west') {
      y = selected.y + (selected.height - height) * factor
      x = attachSide === 'east' ? selected.x + selected.width : selected.x - width
    } else {
      x = selected.x + (selected.width - width) * factor
      y = attachSide === 'south' ? selected.y + selected.height : selected.y - height
    }
    const added = { id: Math.max(...sections.map((section) => section.id)) + 1, x, y, width, height }
    if (sections.some((section) => overlaps(added, section))) {
      setNotice('That placement overlaps another section.')
      return
    }
    updateArea(selectedArea.id, (area) => ({ ...area, sections: [...area.sections, added] }))
    setSelectedId(added.id)
    setNotice('')
  }

  function svgPoint(event: React.PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = event.currentTarget.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const transformed = point.matrixTransform(matrix.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function startDrag(event: React.PointerEvent<SVGGElement>, section: Rect) {
    event.preventDefault()
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    const transformed = point.matrixTransform(matrix.inverse())
    setSelectedId(section.id)
    setDrag({ id: section.id, origin: section, pointer: { x: transformed.x, y: transformed.y }, draft: section })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return
    const point = svgPoint(event)
    setDrag({ ...drag, draft: { ...drag.origin, x: drag.origin.x + point.x - drag.pointer.x, y: drag.origin.y + point.y - drag.pointer.y } })
  }

  function finishDrag() {
    if (!drag) return
    const others = sections.filter((section) => section.id !== drag.id)
    const candidates = others.flatMap((other) => [
      { ...drag.draft, x: other.x + other.width },
      { ...drag.draft, x: other.x - drag.draft.width },
      { ...drag.draft, y: other.y + other.height },
      { ...drag.draft, y: other.y - drag.draft.height },
    ])
    const valid = candidates
      .map((candidate) => {
        const normalized = { ...candidate, x: Math.round(candidate.x * 1000) / 1000, y: Math.round(candidate.y * 1000) / 1000 }
        return { candidate: normalized, distance: Math.hypot(normalized.x - drag.draft.x, normalized.y - drag.draft.y) }
      })
      .filter(({ candidate, distance }) => distance <= Math.max(tileW, tileH) * 1.5 && !others.some((section) => overlaps(candidate, section)))
      .sort((first, second) => first.distance - second.distance)
    const snapped = valid.find(({ candidate }) => connected(sections.map((section) => section.id === drag.id ? candidate : section)))?.candidate
    if (snapped) {
      updateArea(selectedArea.id, (area) => ({ ...area, sections: sections.map((section) => section.id === drag.id ? snapped : section) }))
      setNotice('')
    } else {
      setNotice('Drop the section near an open edge to keep it attached.')
    }
    setDrag(null)
  }

  function updateSection(id: number, key: 'width' | 'height', value: number) {
    if (!Number.isFinite(value) || value <= 0) return
    const next = sections.map((section) => section.id === id ? { ...section, [key]: toInches(value, unit) } : section)
    const updated = next.find((section) => section.id === id)!
    if (next.some((section) => section.id !== id && overlaps(updated, section))) {
      setNotice('That size would overlap another section.')
      return
    }
    if (!connected(next)) {
      setNotice('Keep every section attached to the area.')
      return
    }
    updateArea(selectedArea.id, (area) => ({ ...area, sections: next }))
    setNotice('')
  }

  function removeSection(id: number) {
    const next = sections.filter((section) => section.id !== id)
    if (!connected(next)) {
      setNotice('Remove outer sections first to keep the area connected.')
      return
    }
    updateArea(selectedArea.id, (area) => ({ ...area, sections: next }))
    setNotice('')
  }

  function changeUnit(nextUnit: Unit) {
    setUnit(nextUnit)
    setNewWidth(Number(fromInches(toInches(newWidth, unit), nextUnit).toFixed(2)))
    setNewHeight(Number(fromInches(toInches(newHeight, unit), nextUnit).toFixed(2)))
  }

  const formatMoney = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <main className={`app-shell ${calculatorOpen ? 'has-calculator' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Material Measuring Kit home">
          <span className="brand-mark"><span /></span>
          <span>MMK</span>
        </a>
        <div className="topbar-meta">MATERIAL MEASURING KIT</div>
        <div className="topbar-actions">
          <label className="project-picker"><span>Project</span><select value={activeProject.id} onChange={(event) => selectProject(event.target.value)} aria-label="Select project">{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
          <button className="project-data-button" type="button" onClick={downloadBackup} aria-label="Download project backup" title="Download project backup"><img src={downloadIcon} alt="" /><span>Backup</span></button>
          <button className="project-data-button" type="button" onClick={() => importFileRef.current?.click()} aria-label="Import project backup" title="Import project backup"><img src={packageIcon} alt="" /><span>Import</span></button>
          <input ref={importFileRef} type="file" accept=".json,application/json" onChange={importBackup} hidden aria-label="Select project backup file" />
          <button className="delete-project-button" type="button" onClick={deleteProject} disabled={projects.length <= 1} aria-label="Delete project" title={projects.length <= 1 ? 'At least one project must remain' : 'Delete project'}><img src={trashIcon} alt="" /></button>
          <button className="new-project-button" type="button" onClick={addProject}><img src={addIcon} alt="" /><span>New project</span></button>
          <label className="unit-select"><span>Units</span><select value={unit} onChange={(event) => changeUnit(event.target.value as Unit)} aria-label="Measurement units">
            {(['ft', 'in', 'cm', 'mm'] as Unit[]).map((option) => <option value={option} key={option}>{unitNames[option]}</option>)}
          </select></label>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">PROJECT</p>
          <h1 className="project-heading"><input className="project-name-input" aria-label="Project name" value={activeProject.name} onChange={(event) => updateProject((project) => ({ ...project, name: event.target.value }))} /></h1>
          <p className="intro-copy">Measure areas and plan materials.</p>
        </div>
        <div className="receipt-actions"><div className="receipt-plan-toggle"><span>Show plan</span><button className={`switch ${showPlanInReceipt ? 'is-on' : ''}`} type="button" role="switch" aria-checked={showPlanInReceipt} aria-label="Show plan in receipt" onClick={() => setShowPlanInReceipt((visible) => !visible)}><span /></button></div><button className="receipt-button" type="button" onClick={() => window.print()}><img src={downloadIcon} alt="" /> Print receipt</button></div>
      </section>

      <nav className="view-tabs" role="tablist" aria-label="Material views">
        {(['tiles', 'paint', 'formulas'] as const).map((view) => <button key={view} type="button" role="tab" aria-selected={activeView === view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>{view === 'tiles' ? 'Tiles' : view === 'paint' ? 'Paint' : 'Formulas'}</button>)}
      </nav>

      {activeView === 'tiles' && <div className="workspace">
        <aside className="controls-column">
          <section className="control-section room-section">
            <div className="section-heading"><div><span className="step-index">01</span><h2>Areas</h2></div><span className="section-count">{activeProject.areas.length} {activeProject.areas.length === 1 ? 'area' : 'areas'}</span></div>
            <div className="section-list">
              {activeProject.areas.map((area, index) => (
                <article className={`room-item ${area.id === selectedArea.id ? 'is-selected' : ''}`} key={area.id}>
                  <div className="area-item-heading"><span className="room-item-index">{String(index + 1).padStart(2, '0')}</span><input className="area-name-input" aria-label={`Area ${index + 1} name`} value={area.name} onFocus={() => selectArea(area)} onChange={(event) => updateArea(area.id, (current) => ({ ...current, name: event.target.value }))} />{activeProject.areas.length > 1 && <button className="remove-section" type="button" onClick={() => removeArea(area.id)} aria-label={`Remove ${area.name}`}><img src={trashIcon} alt="" /></button>}</div>
                  <label className="area-set-select"><span>Assigned set</span><select value={area.tileSetId} aria-label={`Tile set assigned to ${area.name}`} onChange={(event) => assignTileSet(area.id, event.target.value)}>{activeProject.tileSets.map((tileSet) => <option value={tileSet.id} key={tileSet.id}>{tileSet.name}</option>)}</select></label>
                  <button className="area-edit-button" type="button" onClick={() => selectArea(area)}>Edit area</button>
                  {area.id === selectedArea.id && <div className="section-dimensions">
                    {sections.map((section, sectionIndex) => <div className="dimension-pair" key={section.id}>
                      <label><span>{sectionIndex === 0 ? 'Width' : `Section ${sectionIndex + 1} width`}</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(section.width, unit))} onValueChange={(value) => updateSection(section.id, 'width', value)} /><small>{unit}</small></span></label>
                      <span className="dimension-times">×</span>
                      <label><span>Length</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(section.height, unit))} onValueChange={(value) => updateSection(section.id, 'height', value)} /><small>{unit}</small></span></label>
                      {sections.length > 1 && <button className="remove-subsection" type="button" onClick={() => removeSection(section.id)} aria-label={`Remove section ${sectionIndex + 1}`}><img src={trashIcon} alt="" /></button>}
                    </div>)}
                  </div>}
                </article>
              ))}
            </div>
            <button className="new-area-button" type="button" onClick={addArea}><img src={addIcon} alt="" /> Add area</button>
            <div className="attach-box">
              <div className="attach-title"><img src={addIcon} alt="" /><span>Add a section to {selectedArea.name}</span></div>
              <div className="attach-dimensions">
                <label><span>Width</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={newWidth} onValueChange={setNewWidth} /><small>{unit}</small></span></label>
                <span className="dimension-times">×</span>
                <label><span>Length</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={newHeight} onValueChange={setNewHeight} /><small>{unit}</small></span></label>
              </div>
              <div className="attach-options">
                <label><span>Attach to</span><select value={attachSide} onChange={(event) => setAttachSide(event.target.value as Side)}><option value="north">North edge</option><option value="east">East edge</option><option value="south">South edge</option><option value="west">West edge</option></select></label>
                <label><span>Line up</span><select value={alignment} onChange={(event) => setAlignment(event.target.value as Alignment)}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label>
              </div>
              <button className="add-section-button" type="button" onClick={addSection}><img src={addIcon} alt="" /> Add section</button>
            </div>
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>

          <section className="control-section tile-calculation-section">
            <div className="section-heading"><div><span className="step-index">02</span><h2>Tile calculation</h2></div></div>
            <span className="field-caption">Calculation method</span>
            <div className="segmented-control calculation-mode"><button className={selectedArea.tileCalculation.mode === 'layout' ? 'active' : ''} type="button" aria-pressed={selectedArea.tileCalculation.mode === 'layout'} onClick={() => updateTileCalculation((calculation) => ({ ...calculation, mode: 'layout' }))}>Placement</button><button className={selectedArea.tileCalculation.mode === 'simple' ? 'active' : ''} type="button" aria-pressed={selectedArea.tileCalculation.mode === 'simple'} onClick={() => updateTileCalculation((calculation) => ({ ...calculation, mode: 'simple' }))}>Simple area</button></div>
            {selectedArea.tileCalculation.mode === 'layout' && <>
              <label className="tile-layout-select"><span>Placement layout</span><select value={selectedArea.tileCalculation.layout} onChange={(event) => updateTileCalculation((calculation) => ({ ...calculation, layout: event.target.value as TileLayout }))}><option value="straight">Straight / grid</option><option value="running-bond">Running bond</option><option value="diagonal">Diagonal</option><option value="herringbone">Herringbone</option></select></label>
              {selectedArea.tileCalculation.layout === 'running-bond' && <div className="bond-offset-fields"><label className="tile-layout-select"><span>Row offset</span><select value={selectedArea.tileCalculation.bondOffsetMode} onChange={(event) => updateTileCalculation((calculation) => ({ ...calculation, bondOffsetMode: event.target.value as BondOffsetMode }))}><option value="half">Half tile</option><option value="third">Third tile</option><option value="custom">Custom fraction</option></select></label>{selectedArea.tileCalculation.bondOffsetMode === 'custom' && <label className="tile-layout-select"><span>Offset of tile width</span><span className="input-wrap"><NumericInput min="5" max="95" step="1" value={Math.round(selectedArea.tileCalculation.customBondOffset * 100)} onValueChange={(value) => updateTileCalculation((calculation) => ({ ...calculation, customBondOffset: Math.min(0.95, Math.max(0.05, value / 100)) }))} /><small>%</small></span></label>}</div>}
              {selectedArea.tileCalculation.layout === 'herringbone' && <p className="section-description layout-note">A 2:1 tile proportion gives the standard herringbone pattern. Other proportions use an approximate count.</p>}
            </>}
            {selectedArea.tileCalculation.mode === 'layout' && <div className="reuse-control"><div><span>Reuse cut tiles</span><p>{tileEstimate.reuseSupported ? 'Uses a best-fit schedule for same-orientation rectangular offcuts.' : 'Irregular, split, or rotated cuts are not reused.'}</p></div><button className={`switch ${selectedArea.tileCalculation.reuseCutTiles ? 'is-on' : ''}`} type="button" role="switch" aria-checked={selectedArea.tileCalculation.reuseCutTiles} aria-label="Reuse cut tiles" disabled={!tileEstimate.reuseSupported} onClick={() => updateTileCalculation((calculation) => ({ ...calculation, reuseCutTiles: !calculation.reuseCutTiles }))}><span /></button></div>}
          </section>

          <section className="control-section tile-section">
            <div className="section-heading"><div><span className="step-index">03</span><h2>Edit tile set</h2></div><button className="new-tile-set-button" type="button" onClick={addTileSet}><img src={addIcon} alt="" /> Add tile set</button></div>
            <label className="tile-set-name-label"><span>Selected set</span><select className="tile-set-name-input" value={editingTileSet.id} onChange={(event) => setEditingTileSetId(event.target.value)}>{activeProject.tileSets.map((tileSet) => <option value={tileSet.id} key={tileSet.id}>{tileSet.name}</option>)}</select></label>
            <label className="tile-set-name-label"><span>Tile set name</span><input className="tile-set-name-input" value={editingTileSet.name} onChange={(event) => updateEditingTileSet((tileSet) => ({ ...tileSet, name: event.target.value }))} /></label>
            <p className="tile-set-assignment">Assigned to {activeProject.areas.filter((area) => area.tileSetId === editingTileSet.id).map((area) => area.name).join(', ') || 'no areas'}</p>
            <div className="section-heading tile-settings-heading"><span className="tile-settings-label">Tile dimensions</span><button className={`icon-control rotate-control ${editingTileSet.rotated ? 'is-active' : ''}`} type="button" onClick={() => updateEditingTileSet((tileSet) => ({ ...tileSet, rotated: !tileSet.rotated }))} aria-label="Rotate tile layout" title="Rotate tile layout"><img src={rotateIcon} alt="" /></button></div>
            <div className="tile-inputs">
              <label><span>Width</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(editingTileSet.width, unit))} onValueChange={(value) => updateEditingTileSet((tileSet) => ({ ...tileSet, width: toInches(value, unit) }))} /><small>{unit}</small></span></label>
              <span className="dimension-times">×</span>
              <label><span>Length</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(editingTileSet.height, unit))} onValueChange={(value) => updateEditingTileSet((tileSet) => ({ ...tileSet, height: toInches(value, unit) }))} /><small>{unit}</small></span></label>
            </div>
            <div className="tile-swatch-row"><span className="tile-swatch" style={{ aspectRatio: `${editingWidth} / ${editingHeight}` }} /><span>{editingTileSet.rotated ? 'Rotated' : 'Default orientation'}</span><span className="tile-unit-note">{displayLength(editingWidth, unit)} × {displayLength(editingHeight, unit)} {unit}</span></div>
          </section>

          <section className="control-section waste-section">
            <div className="section-heading"><div><span className="step-index">04</span><h2>Wastage</h2></div><button className={`switch ${editingTileSet.wasteOn ? 'is-on' : ''}`} type="button" role="switch" aria-checked={editingTileSet.wasteOn} aria-label="Include wastage" onClick={() => updateEditingTileSet((tileSet) => ({ ...tileSet, wasteOn: !tileSet.wasteOn }))}><span /></button></div>
            <p className="section-description">Percentage added to the base tile count.</p>
            {editingTileSet.wasteOn && <label className="waste-input"><span><img src={percentIcon} alt="" /> Wastage</span><span className="input-wrap"><NumericInput min="0" max="100" step="1" value={editingTileSet.wastePercent} onValueChange={(value) => updateEditingTileSet((tileSet) => ({ ...tileSet, wastePercent: Math.min(100, Math.max(0, value)) }))} /><small>%</small></span></label>}
          </section>
        </aside>

        <section className="preview-column">
          <div className="preview-heading"><div><p className="eyebrow">AREA PREVIEW</p><h2>{selectedArea.name}</h2></div><span className="preview-set-name">{assignedTileSet.name} · {displayLength(assignedTileSet.width, unit)} × {displayLength(assignedTileSet.height, unit)} {unit}</span></div>
          <div className="canvas-frame">
            <div className="canvas-toolbar"><span><span className="toolbar-dot" /> PLAN VIEW</span><span>{displayLength(bounds.roomWidth, unit)} × {displayLength(bounds.roomHeight, unit)} {unit}</span></div>
            <svg className="room-canvas" viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => setDrag(null)} role="img" aria-label={`${selectedArea.name} tile plan`}>
              <defs>
                <pattern id="canvas-grid" width={tilePatternWidth} height={tilePatternHeight} patternUnits="userSpaceOnUse" x={0} y={0} patternTransform={selectedArea.tileCalculation.layout === 'diagonal' ? 'rotate(45)' : undefined}>
                  <path d={tilePatternPath} fill="none" stroke="#d6a173" strokeOpacity="0.58" strokeWidth={Math.max(tileW, tileH) * 0.012} />
                </pattern>
                {visualSections.map((section) => <clipPath id={`section-clip-${section.id}`} key={section.id}><rect x={section.x} y={section.y} width={section.width} height={section.height} /></clipPath>)}
              </defs>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#canvas-grid-bg)" />
              {visualSections.map((section) => {
                return <g key={section.id} onPointerDown={(event) => startDrag(event, section)} onClick={() => { setSelectedId(section.id); setNotice('') }} className="canvas-section" role="button" aria-label={`Select area section ${section.id}; drag to reposition`} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(section.id) }}>
                <rect x={section.x} y={section.y} width={section.width} height={section.height} fill="#252724" />
                <rect x={section.x} y={section.y} width={section.width} height={section.height} fill="url(#canvas-grid)" clipPath={`url(#section-clip-${section.id})`} />
                <rect x={section.x} y={section.y} width={section.width} height={section.height} fill="none" stroke={section.id === selectedId ? '#d6a173' : '#77796f'} strokeWidth={section.id === selectedId ? Math.max(tileW, tileH) * 0.055 : Math.max(tileW, tileH) * 0.025} />
                <text x={section.x + section.width / 2} y={section.y + section.height / 2} textAnchor="middle" dominantBaseline="middle" className="canvas-section-label">{section.id === 1 ? selectedArea.name.toUpperCase() : `SECTION ${sections.findIndex((item) => item.id === section.id) + 1}`}</text>
              </g>
              })}
            </svg>
            <div className="canvas-caption"><span><span className="legend-swatch" /> Area outline</span><span><span className="legend-grid" /> {selectedArea.tileCalculation.layout === 'running-bond' ? `Running bond · ${Math.round(bondOffset * 100)}% offset` : selectedArea.tileCalculation.layout === 'diagonal' ? 'Diagonal layout' : selectedArea.tileCalculation.layout === 'herringbone' ? 'Herringbone layout' : 'Straight layout'} · {displayLength(tileW, unit)} × {displayLength(tileH, unit)} {unit}</span><span className="canvas-hint"><img src={moveIcon} alt="" /> Drag sections to reposition</span></div>
          </div>

          <div className="estimate-header"><div><p className="eyebrow">MATERIAL ESTIMATE</p><h2>{selectedArea.name}</h2></div><span className="estimate-count"><strong>{materialTiles.toLocaleString()}</strong><small>tiles total</small></span></div>
          <div className="estimate-lines">
            <div className="estimate-line"><span>{selectedArea.tileCalculation.mode === 'simple' ? 'Area ratio' : selectedArea.tileCalculation.reuseCutTiles ? 'Placement count' : 'Base tiles'}</span><strong>{selectedArea.tileCalculation.mode === 'simple' ? baseTiles.toFixed(2) : selectedArea.tileCalculation.reuseCutTiles ? tileEstimate.layoutPieces.total.toLocaleString() : baseTiles.toLocaleString()} <small>tiles</small></strong></div>
            {selectedArea.tileCalculation.mode === 'layout' && selectedArea.tileCalculation.reuseCutTiles && <div className="estimate-line"><span>Cut-tile reuse</span><strong>−{tileEstimate.reuseSavings} <small>tiles</small></strong></div>}
            {assignedTileSet.wasteOn && <div className="estimate-line waste-line"><span><img src={percentIcon} alt="" /> Wastage <small>{assignedTileSet.wastePercent}%</small></span><strong>+{wasteTiles.toLocaleString(undefined, { minimumFractionDigits: selectedArea.tileCalculation.mode === 'simple' ? 2 : 0, maximumFractionDigits: 2 })} <small>tiles</small></strong></div>}
            <div className="estimate-line total-line"><span>Total tiles</span><strong>{materialTiles.toLocaleString()} <small>tiles</small></strong></div>
          </div>
          <div className="live-computation">
            <button className="computation-toggle" type="button" onClick={() => setShowTileComputation((visible) => !visible)} aria-expanded={showTileComputation}><img src={showTileComputation ? hideIcon : viewIcon} alt="" /><span>{showTileComputation ? 'Hide computation' : 'Show computation'}</span></button>
            {showTileComputation && <div className="computation-details" aria-live="polite">
              <div><span>Tile size entered</span><strong>{displayLength(assignedTileSet.width, unit)} × {displayLength(assignedTileSet.height, unit)} {unit}</strong></div>
              <div><span>Tile dimensions used</span><strong>{displayLength(tileEstimate.tileWidth, unit)} × {displayLength(tileEstimate.tileHeight, unit)} {unit}{tileEstimate.rotated ? ' · rotated' : ''}</strong></div>
              <div className="computation-sections"><span>Room sections</span><strong>{sections.map((section) => `${displayLength(section.width, unit)} × ${displayLength(section.height, unit)} ${unit}`).join(' + ')}</strong></div>
              {selectedArea.tileCalculation.mode === 'simple' ? <>
                <div><span>Room area</span><strong>{(areaInSquareInches(sections) / unitScale[unit] ** 2).toFixed(2)} {unit}²</strong></div>
                <div><span>Tile area</span><strong>{(tileW * tileH / unitScale[unit] ** 2).toFixed(2)} {unit}²</strong></div>
                <p>Rotation swaps tile sides but keeps the same tile area.</p>
                <p>{(areaInSquareInches(sections) / unitScale[unit] ** 2).toFixed(2)} ÷ {(tileW * tileH / unitScale[unit] ** 2).toFixed(2)} = {tileEstimate.areaRatio.toFixed(2)} tiles</p>
                <p>{tileEstimate.areaRatio.toFixed(2)} × {tileEstimate.wastePercent}% = {tileEstimate.wasteTiles.toFixed(2)} extra tiles</p>
                <p>ceil({tileEstimate.areaRatio.toFixed(2)} + {tileEstimate.wasteTiles.toFixed(2)}) = {tileEstimate.materialTiles} tiles</p>
              </> : <>
                <div><span>Placement</span><strong>{selectedArea.tileCalculation.layout.replace('-', ' ')}{selectedArea.tileCalculation.layout === 'running-bond' ? ` · ${Math.round(bondOffset * 100)}% offset` : ''}</strong></div>
                <p>{tileEstimate.layoutPieces.full} whole + {tileEstimate.layoutPieces.cut} cut = {tileEstimate.layoutPieces.total} base tiles{tileEstimate.layoutPieces.approximate ? ' · approximate for this tile proportion' : ''}</p>
                <p>Measured partial-tile area: {(tileEstimate.layoutPieces.cutArea / squareUnitScale).toFixed(2)} {unit}² across {tileEstimate.layoutPieces.cut} cut positions</p>
                <p>{tileEstimate.reuseSupported ? `Best-fit offcut schedule: ${tileEstimate.layoutPieces.full} whole + ${tileEstimate.layoutPieces.cut - tileEstimate.reuseSavings} cut-stock tiles = ${tileEstimate.reusedBaseTiles} base tiles; saves ${tileEstimate.reuseSavings} tiles` : 'Offcut reuse is not counted for split or irregular cut profiles'}{selectedArea.tileCalculation.reuseCutTiles && tileEstimate.reuseSupported ? ' · applied' : ' · not applied'}</p>
                <div className="computation-rows"><span>Tile positions by row</span>{tileEstimate.layoutPieces.rows.map((row, index) => <div key={row.row}><span>Row {index + 1}</span><strong>{row.full} whole + {row.cut} cut = {row.full + row.cut}</strong></div>)}</div>
                {selectedCutSummaries.length > 0 && <div className="computation-rows"><span>Exact cuts and remainders</span>{selectedCutSummaries.map((cut, index) => <div key={`${cut.piece}-${index}`}><span>{cut.quantity} × {cut.piece}<small>{cut.instruction}</small></span><strong>{cut.positions.join(', ')}</strong></div>)}</div>}
                <p>{tileEstimate.baseTiles} × {tileEstimate.wastePercent}% wastage = {tileEstimate.wasteTiles} extra</p>
                <p>{tileEstimate.baseTiles} + {tileEstimate.wasteTiles} = {tileEstimate.materialTiles} tiles</p>
              </>}
            </div>}
          </div>
          <button className={`price-toggle ${assignedTileSet.priceOpen ? 'is-open' : ''}`} type="button" onClick={() => updateAssignedTileSet((tileSet) => ({ ...tileSet, priceOpen: !tileSet.priceOpen }))} aria-expanded={assignedTileSet.priceOpen}><span className="price-icon"><img src={moneyIcon} alt="" /></span><span><strong>Price estimate</strong><small>{assignedTileSet.priceOpen ? 'Hide price options' : 'Optional pricing'}</small></span><span className="price-chevron">{assignedTileSet.priceOpen ? '−' : '+'}</span></button>
          {assignedTileSet.priceOpen && <div className="price-panel">
            <div className="price-panel-heading"><div><img src={packageIcon} alt="" /><span>Sold by</span></div><div className="segmented-control"><button className={assignedTileSet.priceMode === 'tile' ? 'active' : ''} type="button" onClick={() => updateAssignedTileSet((tileSet) => ({ ...tileSet, priceMode: 'tile' }))}>Tile</button><button className={assignedTileSet.priceMode === 'box' ? 'active' : ''} type="button" onClick={() => updateAssignedTileSet((tileSet) => ({ ...tileSet, priceMode: 'box' }))}>Box</button></div></div>
            {assignedTileSet.priceMode === 'box' && <div className="segmented-control box-content-mode"><button className={assignedTileSet.boxContentMode === 'tiles' ? 'active' : ''} type="button" onClick={() => updateAssignedTileSet((tileSet) => ({ ...tileSet, boxContentMode: 'tiles' }))}>Tiles per box</button><button className={assignedTileSet.boxContentMode === 'area' ? 'active' : ''} type="button" onClick={() => updateAssignedTileSet((tileSet) => ({ ...tileSet, boxContentMode: 'area' }))}>Area per box</button></div>}
            <div className="price-fields">
              <label><span>Price per {assignedTileSet.priceMode}</span><span className="currency-input"><span>₱</span><NumericInput min="0" step="0.01" value={assignedTileSet.unitPrice} onValueChange={(value) => updateAssignedTileSet((tileSet) => ({ ...tileSet, unitPrice: Math.max(0, value) }))} /></span></label>
              {assignedTileSet.priceMode === 'box' && assignedTileSet.boxContentMode === 'tiles' && <label><span>Tiles per box</span><span className="input-wrap"><NumericInput min="1" step="1" value={assignedTileSet.tilesPerBox} onValueChange={(value) => updateAssignedTileSet((tileSet) => ({ ...tileSet, tilesPerBox: Math.max(1, value) }))} /><small>tiles</small></span></label>}
              {assignedTileSet.priceMode === 'box' && assignedTileSet.boxContentMode === 'area' && <label><span>Coverage per box</span><div className="area-input-pair coverage-input"><span className="input-wrap"><NumericInput min="0.01" step="0.01" value={assignedTileSet.coveragePerBox} onValueChange={(value) => updateAssignedTileSet((tileSet) => ({ ...tileSet, coveragePerBox: Math.max(0.01, value) }))} /><small>area</small></span><select aria-label="Coverage unit" value={assignedTileSet.coverageUnit} onChange={(event) => updateAssignedTileSet((tileSet) => ({ ...tileSet, coverageUnit: event.target.value as AreaUnit }))}><option value="m2">m²</option><option value="ft2">ft²</option></select></div></label>}
            </div>
            <div className="price-result"><span>{assignedTileSet.priceMode === 'box' ? assignedTileSet.boxContentMode === 'tiles' ? `${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} · ${boxCount * assignedTileSet.tilesPerBox} tiles` : `${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} · ${(boxCount * assignedTileSet.coveragePerBox).toFixed(2)} ${areaUnitLabels[assignedTileSet.coverageUnit]} coverage` : `${materialTiles.toLocaleString()} tiles`}</span><strong>{formatMoney(priceTotal)}</strong></div>
          </div>}
          <p className="estimate-footnote">Estimate excludes installation and delivery.</p>
        </section>
      </div>}

      {activeView === 'paint' && <section className="paint-workspace">
        <div className="paint-controls">
          <div className="paint-page-heading"><div><p className="eyebrow">PAINT ESTIMATE</p><h2>{selectedArea.name}</h2></div><label className="paint-area-picker"><span>Area</span><select value={selectedArea.id} onChange={(event) => {
            const area = activeProject.areas.find((entry) => entry.id === Number(event.target.value))
            if (area) selectArea(area)
          }}>{activeProject.areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}</select></label></div>
          <div className="paint-field-group">
            <span className="field-caption">Painted area source</span>
            <div className="segmented-control source-toggle"><button className={selectedArea.paint.source === 'outline' ? 'active' : ''} type="button" aria-pressed={selectedArea.paint.source === 'outline'} onClick={() => updatePaint((paint) => ({ ...paint, source: 'outline' }))}>Canvas outline</button><button className={selectedArea.paint.source === 'manual' ? 'active' : ''} type="button" aria-pressed={selectedArea.paint.source === 'manual'} onClick={() => updatePaint((paint) => ({ ...paint, source: 'manual' }))}>Manual area</button></div>
          </div>
          {selectedArea.paint.source === 'outline' ? <>
            <div className="paint-outline-summary"><span>Wall outline from {sections.length} {sections.length === 1 ? 'section' : 'sections'}</span><strong>{(outlinePerimeter(sections) * 0.0254).toFixed(2)} m perimeter</strong></div>
            <label className="paint-field"><span>Wall height</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(selectedArea.paint.wallHeight, unit))} onValueChange={(value) => {
              if (value > 0) updatePaint((paint) => ({ ...paint, wallHeight: toInches(value, unit) }))
            }} /><small>{unit}</small></span></label>
            <div className="opening-heading"><span>Openings to subtract</span><button className="new-tile-set-button" type="button" onClick={addOpening}><img src={addIcon} alt="" /> Add opening</button></div>
            {selectedArea.paint.openings.map((opening, index) => <div className="opening-row" key={opening.id}>
              <label><span>Count</span><span className="input-wrap"><NumericInput min="0" step="1" value={opening.count} onValueChange={(value) => updateOpening(opening.id, (current) => ({ ...current, count: Math.max(0, Math.floor(value)) }))} /><small>×</small></span></label>
              <label><span>Width</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(opening.width, unit))} onValueChange={(value) => {
                if (value > 0) updateOpening(opening.id, (current) => ({ ...current, width: toInches(value, unit) }))
              }} /><small>{unit}</small></span></label>
              <label><span>Height</span><span className="input-wrap"><NumericInput min="0.1" step="0.1" value={Number(displayLength(opening.height, unit))} onValueChange={(value) => {
                if (value > 0) updateOpening(opening.id, (current) => ({ ...current, height: toInches(value, unit) }))
              }} /><small>{unit}</small></span></label>
              <button className="remove-subsection" type="button" onClick={() => removeOpening(opening.id)} aria-label={`Remove opening ${index + 1}`}><img src={trashIcon} alt="" /></button>
            </div>)}
            <label className="paint-field"><span>Additional opening area</span><div className="area-input-pair"><span className="input-wrap"><NumericInput min="0" step="0.1" value={selectedArea.paint.openingArea} onValueChange={(value) => updatePaint((paint) => ({ ...paint, openingArea: Math.max(0, value) }))} /><small>{selectedArea.paint.openingAreaUnit === 'm2' ? 'm²' : 'ft²'}</small></span><select aria-label="Additional opening area units" value={selectedArea.paint.openingAreaUnit} onChange={(event) => updatePaint((paint) => ({ ...paint, openingAreaUnit: event.target.value as AreaUnit }))}><option value="m2">m²</option><option value="ft2">ft²</option></select></div></label>
          </> : <label className="paint-field"><span>Painted area</span><div className="area-input-pair"><span className="input-wrap"><NumericInput min="0" step="0.1" value={selectedArea.paint.manualArea} onValueChange={(value) => updatePaint((paint) => ({ ...paint, manualArea: Math.max(0, value) }))} /><small>{selectedArea.paint.manualUnit === 'm2' ? 'm²' : 'ft²'}</small></span><select aria-label="Painted area units" value={selectedArea.paint.manualUnit} onChange={(event) => updatePaint((paint) => ({ ...paint, manualUnit: event.target.value as AreaUnit }))}><option value="m2">m²</option><option value="ft2">ft²</option></select></div></label>}
          <div className="paint-final-fields">
            <label className="paint-field"><span>Coats</span><span className="input-wrap"><NumericInput min="1" step="1" value={selectedArea.paint.coats} onValueChange={(value) => updatePaint((paint) => ({ ...paint, coats: Math.max(1, Math.floor(value)) }))} /><small>coats</small></span></label>
            <label className="paint-field"><span>Price per {selectedArea.paint.volume === 'litres' ? 'L' : 'gallon'}</span><span className="currency-input"><span>₱</span><NumericInput min="0" step="0.01" value={selectedArea.paint.unitPrice} onValueChange={(value) => updatePaint((paint) => ({ ...paint, unitPrice: Math.max(0, value) }))} /></span></label>
          </div>
          <div className="paint-volume-row"><span>Quantity in</span><div className="segmented-control"><button className={selectedArea.paint.volume === 'litres' ? 'active' : ''} type="button" onClick={() => updatePaint((paint) => ({ ...paint, volume: 'litres' }))}>Litres</button><button className={selectedArea.paint.volume === 'gallons' ? 'active' : ''} type="button" onClick={() => updatePaint((paint) => ({ ...paint, volume: 'gallons' }))}>Gallons</button></div></div>
        </div>
        <aside className="paint-summary">
          <p className="eyebrow">MATERIAL ESTIMATE</p>
          <h2>{selectedArea.name}</h2>
          <div className="paint-summary-area"><span>Net painted area</span><strong>{paintEstimate.netArea.toFixed(2)} m²</strong><small>{areaFromSquareMetres(paintEstimate.netArea, 'ft2').toFixed(2)} ft²</small></div>
          {selectedArea.paint.source === 'outline' && <div className="paint-summary-lines"><div><span>Canvas outline</span><strong>{paintEstimate.grossArea.toFixed(2)} m²</strong></div><div><span>Openings</span><strong>−{paintEstimate.deductions.toFixed(2)} m²</strong></div></div>}
          <div className="paint-quantity"><span>Paint needed · {paintEstimate.coats} {paintEstimate.coats === 1 ? 'coat' : 'coats'}</span><strong>{paintEstimate.quantity.toFixed(2)} <small>{selectedArea.paint.volume === 'litres' ? 'L' : 'gal'}</small></strong></div>
          <div className="paint-price-result"><span>Estimated paint cost</span><strong>{formatMoney(paintEstimate.cost)}</strong></div>
          <p className="paint-coverage-note">{selectedArea.paint.volume === 'litres' ? '4 L' : '1 gallon'} covers 25 m² per coat.</p>
          <div className="live-computation paint-computation">
            <button className="computation-toggle" type="button" onClick={() => setShowPaintComputation((visible) => !visible)} aria-expanded={showPaintComputation}><img src={showPaintComputation ? hideIcon : viewIcon} alt="" /><span>{showPaintComputation ? 'Hide computation' : 'Show computation'}</span></button>
            {showPaintComputation && <div className="computation-details" aria-live="polite">
              {selectedArea.paint.source === 'manual' ? <>
                <div><span>Entered area</span><strong>{selectedArea.paint.manualArea.toFixed(2)} {selectedArea.paint.manualUnit === 'm2' ? 'm²' : 'ft²'}</strong></div>
                <p>{selectedArea.paint.manualArea.toFixed(2)} {selectedArea.paint.manualUnit === 'm2' ? 'm²' : 'ft²'} = {paintEstimate.netArea.toFixed(2)} m²</p>
              </> : <>
                <div><span>Outline perimeter</span><strong>{(outlinePerimeter(sections) * 0.0254).toFixed(2)} m</strong></div>
                <p>{(outlinePerimeter(sections) * 0.0254).toFixed(2)} m × {(selectedArea.paint.wallHeight * 0.0254).toFixed(2)} m = {paintEstimate.grossArea.toFixed(2)} m²</p>
                <p>{paintEstimate.grossArea.toFixed(2)} − {paintEstimate.countedOpenings.toFixed(2)} counted − {paintEstimate.directOpeningArea.toFixed(2)} additional = {paintEstimate.netArea.toFixed(2)} m²</p>
              </>}
              <p>{paintEstimate.netArea.toFixed(2)} m² × {paintEstimate.coats} coats{selectedArea.paint.volume === 'litres' ? ' × 4 ÷ 25' : ' ÷ 25'} = {paintEstimate.quantity.toFixed(2)} {selectedArea.paint.volume === 'litres' ? 'L' : 'gallons'}</p>
              <p>{paintEstimate.quantity.toFixed(2)} × {formatMoney(selectedArea.paint.unitPrice)} = {formatMoney(paintEstimate.cost)}</p>
            </div>}
          </div>
        </aside>
      </section>}

      {activeView === 'formulas' && <section className="calculations-workspace">
        <div className="calculations-heading"><div><p className="eyebrow">REFERENCE</p><h2>Formulas</h2></div></div>
        <div className="formula-list">
          <article className="formula-item"><span className="formula-index">01</span><div><h3>Simple area tile quantity</h3><p>Use the room area and the area of one tile, then apply the selected tile set's wastage percentage and round up to a whole tile.</p><strong>Raw quantity = room area ÷ tile area</strong><strong>Total tiles = ceil(raw quantity × (1 + wastage% ÷ 100))</strong></div></article>
          <article className="formula-item"><span className="formula-index">02</span><div><h3>Placement tile quantity</h3><p>Count whole and cut positions from the layout. Optional reuse follows a deterministic best-fit schedule for measured, same-orientation rectangular offcuts; irregular, split, or rotated profiles are excluded.</p><strong>Base tiles = whole positions + new cut-stock tiles in the fit schedule</strong><strong>Total tiles = base tiles + ceil(base tiles × wastage% ÷ 100)</strong></div></article>
          <article className="formula-item"><span className="formula-index">03</span><div><h3>Canvas paint area</h3><p>Remove joined section edges from the outline perimeter, multiply by wall height, convert to square metres, then subtract counted and additional opening area.</p><strong>Net area = max(0, perimeter × wall height − opening area)</strong></div></article>
          <article className="formula-item"><span className="formula-index">04</span><div><h3>Manual paint area</h3><p>Enter area in square metres or square feet. Square feet are converted using 1 m² = 10.7639 ft².</p><strong>Net area = entered area in m²</strong></div></article>
          <article className="formula-item"><span className="formula-index">05</span><div><h3>Paint quantity and cost</h3><p>Quantities scale by coat count. Litres and gallons use the specified coverage rates independently.</p><strong>Litres = area × coats × 4 ÷ 25</strong><strong>Gallons = area × coats ÷ 25</strong><strong>Cost = quantity × price per selected unit</strong></div></article>
          <article className="formula-item"><span className="formula-index">06</span><div><h3>Boxes by supplier coverage</h3><p>Use the supplier's stated covered area per box instead of the tile count when calculating purchases.</p><strong>Boxes = ceil(required tile area ÷ coverage per box)</strong></div></article>
        </div>
      </section>}

      <footer className="app-footer"><span>MATERIAL MEASURING KIT</span><span>UNITS: {unit.toUpperCase()}</span></footer>
      <section className="receipt-print">
        <p className="receipt-kicker">MATERIAL RECEIPT</p>
        <h1>{activeProject.name || 'Untitled project'}</h1>
        <p>Created {new Date().toLocaleDateString()}</p>
        <h2>Area quantities</h2>
        <table><thead><tr><th>Area</th><th>Sections</th><th>Tile set / size</th><th>Layout</th><th>Base</th><th>Waste</th><th>Waste %</th><th>Total</th></tr></thead><tbody>{receiptItems.map((item) => <tr key={item.area.id}><td>{item.area.name}</td><td>{item.area.sections.map((section, index) => `Section ${index + 1}: ${displayLength(section.width, unit)} × ${displayLength(section.height, unit)} ${unit}`).join(' · ')}</td><td>{item.tileSet.name} · {displayLength(item.tileSet.width, unit)} × {displayLength(item.tileSet.height, unit)} {unit}</td><td>{getTileLayoutName(item.area.tileCalculation)}</td><td>{item.base.toFixed(item.area.tileCalculation.mode === 'simple' ? 2 : 0)}</td><td>{item.waste.toFixed(2)}</td><td>{item.wastePercent}%</td><td>{item.total} tiles</td></tr>)}</tbody></table>
        {showPlanInReceipt && <>
          <h2>Tile plans</h2>
          {receiptItems.map((item) => <figure className="receipt-plan" key={item.area.id}>
            <figcaption><strong>{item.area.name}</strong><span>{item.tileSet.name} · {displayLength(item.tileWidth, unit)} × {displayLength(item.tileHeight, unit)} {unit} · {getTileLayoutName(item.area.tileCalculation)}</span></figcaption>
            <svg viewBox={`${item.bounds.minX - item.tileWidth * 0.2} ${item.bounds.minY - item.tileHeight * 0.2} ${item.bounds.width + item.tileWidth * 0.4} ${item.bounds.height + item.tileHeight * 0.4}`} role="img" aria-label={`${item.area.name} ${getTileLayoutName(item.area.tileCalculation)} tile plan`}>
              <defs><pattern id={`receipt-grid-${item.area.id}`} width={item.pattern.width} height={item.pattern.height} patternUnits="userSpaceOnUse" patternTransform={item.pattern.transform}><path d={item.pattern.path} fill="none" stroke="#111" strokeWidth={Math.max(item.tileWidth, item.tileHeight) * 0.012} /></pattern></defs>
              {item.area.sections.map((section) => <g key={section.id}><rect x={section.x} y={section.y} width={section.width} height={section.height} fill={`url(#receipt-grid-${item.area.id})`} stroke="#111" strokeWidth={Math.max(item.tileWidth, item.tileHeight) * 0.025} /></g>)}
            </svg>
            <p>Room: {item.area.sections.map((section, index) => `Section ${index + 1} ${displayLength(section.width, unit)} × ${displayLength(section.height, unit)} ${unit}`).join(' · ')}. Tile: {displayLength(item.tileWidth, unit)} × {displayLength(item.tileHeight, unit)} {unit}. Layout: {getTileLayoutName(item.area.tileCalculation)}.</p>
          </figure>)}
        </>}
        <h2>Exact cut list</h2>
        {receiptCutItems.length > 0
          ? <table className="receipt-cut-table"><thead><tr><th>Area / tile set</th><th>Qty</th><th>Piece / profile</th><th>Cut and remainder</th><th>Pattern positions</th></tr></thead><tbody>{receiptCutItems.map((cut) => <tr key={`${cut.area.id}-${cut.index}`}><td>{cut.area.name} · {cut.tileSet.name}</td><td>{cut.quantity}</td><td>{cut.piece}</td><td>{cut.instruction}</td><td>{cut.positions.join(', ')}</td></tr>)}</tbody></table>
          : <p>No partial tiles require cutting.</p>}
        <h2>Tile set totals</h2>
        <table><thead><tr><th>Tile set</th><th>Base</th><th>Waste</th><th>Waste %</th><th>Total needed</th><th>Boxes / contents</th><th>Estimate</th></tr></thead><tbody>{receiptTileSets.map(({ tileSet, base, waste, wastePercent, total, boxes, amount }) => <tr key={tileSet.id}><td>{tileSet.name}</td><td>{Number(base.toFixed(2)).toLocaleString()}</td><td>{waste.toFixed(2)}</td><td>{wastePercent}%</td><td>{total} tiles</td><td>{tileSet.priceMode === 'box' ? tileSet.boxContentMode === 'area' ? `${boxes} boxes × ${tileSet.coveragePerBox} ${areaUnitLabels[tileSet.coverageUnit]}/box = ${(boxes * tileSet.coveragePerBox).toFixed(2)} ${areaUnitLabels[tileSet.coverageUnit]} covered` : `${boxes} boxes × ${tileSet.tilesPerBox} tiles/box = ${boxes * tileSet.tilesPerBox} tiles` : 'Per tile'}</td><td>{formatMoney(amount)}</td></tr>)}</tbody></table>
        <h2>Paint by area</h2>
        <table><thead><tr><th>Area</th><th>Source</th><th>Painted area</th><th>Coats</th><th>Quantity</th><th>Estimate</th></tr></thead><tbody>{receiptPaintItems.map((item) => <tr key={item.area.id}><td>{item.area.name}</td><td>{item.area.paint.source === 'outline' ? 'Canvas outline' : 'Manual area'}</td><td>{item.netArea.toFixed(2)} m²</td><td>{item.coats}</td><td>{item.quantity.toFixed(2)} {item.area.paint.volume === 'litres' ? 'L' : 'gallons'}</td><td>{formatMoney(item.cost)}</td></tr>)}</tbody></table>
        <p className="receipt-total">Estimated total <strong>{formatMoney(receiptTotal)}</strong></p>
      </section>
      {calculatorOpen
        ? <Calculator onHide={() => setCalculatorOpen(false)} />
        : <button className="calculator-reopen" type="button" onClick={() => setCalculatorOpen(true)}>Calculator</button>}
    </main>
  )
}

export default App
