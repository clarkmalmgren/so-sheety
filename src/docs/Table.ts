import { docs_v1 } from 'googleapis'
import { CellValue, isLink } from '../grid/CellValue'
import { Grid, RowObject } from '../grid/Grid'
import { Row } from '../grid/Row'
import { toCellValue } from './converters'
import { TableRefControls } from './refs/TableRef'

function arr<T>(len: number, fn: (i: number) => T): T[] {
  const a: T[] = []
  for (let i = 0; i < len; i++) {
    a.push(fn(i))
  }
  return a
}

function arr2d<T>(rows: number, cols: number, fn: (r: number, c: number) => T): T[][] {
  return arr(rows, (r) => arr(cols, (c) => fn(r, c)))
}

function toText(v: CellValue): string {
  if (isLink(v)) { return v.text }
  if (typeof v === 'undefined') { return '' }
  return `${v}`
}

export class Table extends Grid {

  protected readonly editable: boolean = true

  static parse(table: docs_v1.Schema$Table, frozenRowCount: number, controls: TableRefControls): Table {
    const rowCount = table.rows
    const colCount = table.columns
    if (!rowCount || !colCount) { throw new Error(`Table is empty, can't load a table of size ${rowCount}x${colCount}`) }

    const data: CellValue[][] = arr2d(rowCount, colCount, (r, c) => toCellValue(table, r, c))

    const _rows: RowSize[] =
      arr(rowCount, (r) => {
        const cells: CellSize[] = arr(colCount, (c) => {
          const cell = table.tableRows?.[r].tableCells?.[c]
          if (!cell) { throw new Error(`Cell at [${r}, ${c}] is undefined`) }
          if (!cell.startIndex || !cell.endIndex) { throw new Error(`Cell at [${r}, ${c}] has no start or end index`) }
          return new CellSize(cell.endIndex - cell.startIndex)
        })
        return new RowSize(cells)
      })

    return new Table(data, frozenRowCount, _rows, controls)
  }

  static create(headers: CellValue[], controls: TableRefControls): Table {
    // First we create a temporary table with no headers so that we can initalize the table easily
    const initData = arr(headers.length, () => [])
    const initRows = [ new RowSize(headers.map(_ => new CellSize(2))) ]
    const initTable = new Table(initData, 0, initRows, controls)
    headers.forEach((h, i) => initTable.set(0, i, h))

    // Now we create the real table and return it
    const data: CellValue[][] = [ headers ]
    const rows: RowSize[] = [ new RowSize(headers.map(h => new CellSize(toText(h).length + 2))) ]
    return new Table(data, 1, rows, controls)
  }

  constructor(
    data: CellValue[][],
    readonly frozenRowCount: number,
    private _rows: RowSize[],
    private readonly controls: TableRefControls
  ) {
    super(data, frozenRowCount)
  }

  updateSize(): void {
    const size = this._rows.reduce((acc, row) => acc + row.size, 0)
    this.controls.setSize(size + 2) // +2 for the table overhead
  }

  protected _set(row: number, col: number, value: CellValue): void {
    if (row >= this.length) {
      throw new Error(`Row ${row} is outside the current size of the table. For document tables, you must add rows first before editing`)
    }

    const rawRow = row + this.frozenRowCount

    // Calculate the start index of the cell
    let startIndex = this.controls.startIndex() + 1 // +1 for the table itself
    for (let r = 0; r < rawRow; r++) {
      startIndex += this._rows[r].size
    }
    startIndex += 1 // +1 for this row
    for (let c = 0; c < col; c++) {
      startIndex += this._rows[rawRow].cells[c].size
    }

    const cell = this._rows[rawRow].cells[col]
    const text = toText(value)

    // Delete the existing content if is not empty (2 bytes is an empty cell)
    if (cell.size > 2) {
      this.controls.mutator.request({
        deleteContentRange: {
          range: {
            startIndex: startIndex + 1,
            endIndex: startIndex + cell.size - 1
          }
        }
      })
    }

    // Add the text and update the cell size (required for future cells to keep track of offsets)
    cell.size = text.length + 2 // +1 for the cell & +1 for the newline at the end of the cell contents
    this.controls.mutator.request({ insertText: { location: { index: startIndex + 1 }, text } })
    
    // If it is a link, we have to update the style in addition to inserting the text
    if (isLink(value)) {
      this.controls.mutator.request({
        updateTextStyle: {
          range: { startIndex: startIndex + 1, endIndex: startIndex + cell.size - 1 },
          fields: 'link',
          textStyle: {
            link: { url: value.url }
          }
        }
      })
    }

    this.updateSize()
  }

  override append(obj: RowObject = {}): Row {
    this.controls.mutator.request({
      insertTableRow: {
        insertBelow: true,
        tableCellLocation: {
          tableStartLocation: { index: this.controls.startIndex() },
          rowIndex: this._rows.length - 1
        }
      }
    })

    this._rows.push(new RowSize(arr(this._rows[0].cells.length, () => new CellSize(2))))
    this.updateSize()

    // Add the empty row to the data
    this.data.push([])

    const row = this.row(this.data.length - 1)
    row.setObj(obj)
    return row
  }

  protected _commit(): Promise<void> {
    return this.controls.mutator.commit()
  }

  style(style: TableStyle, row: number, col: number, columnSpan: number = 1): void {
    const rawRow = row + this.frozenRowCount
    
    // Apply the table cell style (if it was included)
    const tableCellStyle = toTableCellStyle(style)
    if (Object.keys(tableCellStyle).length > 0) {
      this.controls.mutator.request({
        updateTableCellStyle: {
          fields: Object.keys(tableCellStyle).join(','),
          tableRange: {
            rowSpan: 1,
            columnSpan: columnSpan,
            tableCellLocation: {
              tableStartLocation: { index: this.controls.startIndex() },
              rowIndex: rawRow,
              columnIndex: col
            }
          },
          tableCellStyle
        }
      })
    }

    // Get the text & paragraph styles. If they're both empty, return early before calculating all the offsets
    const textStyle = toTextStyle(style)
    const paragraphStyle = toParagraphStyle(style)
    if (Object.keys(textStyle).length === 0 && Object.keys(paragraphStyle).length === 0) { return }

    // Calculate the start index of the cell
    let startIndex = this.controls.startIndex() + 1 // +1 for the table itself
    for (let r = 0; r < rawRow; r++) {
      startIndex += this._rows[r].size
    }
    startIndex += 1 // +1 for this row
    for (let c = 0; c < col; c++) {
      startIndex += this._rows[rawRow].cells[c].size
    }

    startIndex += 1 // +1 for the cell itself
    const size = this._rows[rawRow].cells.slice(col, col + columnSpan).reduce((acc, cell) => acc + cell.size, 0) - 2

    if (Object.keys(textStyle).length > 0) {
      this.controls.mutator.request({
        updateTextStyle: {
          range: { startIndex, endIndex: startIndex + size },
          fields: Object.keys(textStyle).join(','),
          textStyle
        }
      })
    }

    if (Object.keys(paragraphStyle).length > 0) {
      this.controls.mutator.request({
        updateParagraphStyle: {
          range: { startIndex, endIndex: startIndex + size },
          fields: Object.keys(paragraphStyle).join(','),
          paragraphStyle
        }
      })
    }
  }

  styleRow(style: TableStyle, row: number): void {
    const rawRow = row + this.frozenRowCount
    this.style(style, row, 0, this._rows[rawRow].cells.length)
  }
}

export type TableStyle = {
  textColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: number
  fontFamily?: string

  backgroundColor?: string
  padding?: number

  verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM'
  horizontalAlignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFY'
}

function toParagraphStyle(style: TableStyle): docs_v1.Schema$ParagraphStyle {
  const ps: docs_v1.Schema$ParagraphStyle = {}

  if (style.horizontalAlignment) { ps.alignment = style.horizontalAlignment }

  return ps
}

function toTextStyle(style: TableStyle): docs_v1.Schema$TextStyle {
  const ps: docs_v1.Schema$TextStyle = {}

  if (style.textColor) { ps.foregroundColor = hexToColor(style.textColor) }
  if (typeof style.bold === 'boolean') { ps.bold = style.bold }
  if (typeof style.italic === 'boolean') { ps.italic = style.italic }
  if (typeof style.underline === 'boolean') { ps.underline = style.underline }
  if (typeof style.strikethrough === 'boolean') { ps.strikethrough = style.strikethrough }
  if (style.fontSize) { ps.fontSize = { unit: 'PT', magnitude: style.fontSize } }
  if (style.fontFamily) { ps.weightedFontFamily = { fontFamily: style.fontFamily } }

  return ps
}

function toTableCellStyle(style: TableStyle): docs_v1.Schema$TableCellStyle {
  const ts: docs_v1.Schema$TableCellStyle = {}

  if (style.backgroundColor) {
    ts.backgroundColor = hexToColor(style.backgroundColor)
  }

  if (style.padding) {
    const pad = { unit: 'PT', magnitude: style.padding * 72 }
    ts.paddingTop =    pad
    ts.paddingBottom = pad
    ts.paddingLeft =   pad
    ts.paddingRight =  pad
  }

  if (style.verticalAlignment) {
    ts.contentAlignment = style.verticalAlignment
  }

  return ts
}

function hexToColor(hex: string): docs_v1.Schema$OptionalColor {
  hex = hex.replace("#", "");

  // Handle 3-digit hex codes
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  return {
    color: {
      rgbColor: {
        red: parseInt(hex.slice(0, 2), 16) / 255,
        green: parseInt(hex.slice(2, 4), 16) / 255,
        blue: parseInt(hex.slice(4, 6), 16) / 255
      }
    }
  }
}

class RowSize {
  constructor(readonly cells: CellSize[]) {}
  get size(): number {
    return this.cells.reduce((acc, cell) => acc + cell.size, 0) + 1 // +1 for the row itself
  }
}

class CellSize {
  constructor(public size: number) {}
}
