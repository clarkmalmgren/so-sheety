import { CellValue, cellValuesEqual, isLink } from './CellValue'
import { Row } from './Row'

export type RowObject = { [header: string]: CellValue }
export type ColumnLocator = string | number

export abstract class Grid {

  protected data: CellValue[][]
  protected columns: Record<string, number> = {}
  protected abstract readonly editable: boolean
  protected appends: number = 0

  constructor(allData: CellValue[][], protected readonly frozenRowCount: number) {
    if (allData.length < this.frozenRowCount) {
      throw new Error(`Sheet has less data than frozen rows. Must at least have filled out headers`)
    }
    
    if (this.frozenRowCount) {
      const headers = allData[this.frozenRowCount - 1]
      headers.forEach((h, col) => {
        const name = isLink(h) ? h.text : `${h}`
        this.columns[name] = col
      })
    }

    this.data = allData.slice(this.frozenRowCount)
  }

  column(locator: ColumnLocator): number | undefined {
    return typeof locator === 'number' ? locator : this.columns[locator]
  }

  get(row: number, col: ColumnLocator): CellValue {
    const cl = this.column(col)
    if (typeof cl === 'undefined') { return undefined }
    return this.data[row][cl]
  }

  raw(offset: number): CellValue[] {
    return [ ...this.data[offset] ]
  }

  get length(): number {
    return this.data.length
  }

  obj(offset: number): RowObject {
    const r = this.data[offset]
    const resp: RowObject = {}
    Object.keys(this.columns).forEach(header => {
      const col = this.columns[header]
      resp[header] = r[col]
    })
    return resp
  }

  row(offset: number): Row {
    return new Row(this, offset)
  }

  rows(start?: number, end?: number): Row[] {
    return Array(this.data.length)
      .fill(0)
      .map((_, i) => i)
      .slice(start, end)
      .map(i => this.row(i))
  }

  find(selector: (row: Row) => boolean): Row | undefined {
    return this.rows().find(selector)
  }

  lookup(col: ColumnLocator, value: CellValue): Row | undefined {
    return this.find(r => r.eq(col, value))
  }

  forEach(fn: (value: Row, index: number, array: Row[]) => void): void {
    this.rows().forEach(fn)
  }

  map<T>(fn: (value: Row, index: number, array: Row[]) => T): T[] {
    return this.rows().map(fn)
  }

  private assertEditable(): void {
    if (!this.editable) {
      throw new Error('This Grid is not editable!')
    }
  }

  protected abstract _set(row: number, col: number, value: CellValue): void

  set(row: number, cl: ColumnLocator, value: CellValue): void {
    this.assertEditable()

    // Lookup the column
    const col = this.column(cl)
    if (typeof col === 'undefined') { return }

    // Ensure the row actually exists
    if (row - this.data.length > 100) {
      throw new Error(`Will not implicitly create more than a hundred rows`)
    }
    while (row >= this.data.length) {
      this.append()
    }

    // If the value hasn't changed, we are done
    const existing = this.data[row][col]
    if (cellValuesEqual(existing, value, true)) { return }

    // Ok, finally commit to making the change
    this.data[row][col] = value
    this._set(row, col, value)
  }

  append(obj: RowObject = {}): Row {
    this.assertEditable()

    this.data.push([])
    this.appends++

    const offset = this.data.length - 1
    const row = this.row(offset)
    row.setObj(obj)
    return row
  }

  protected abstract _commit(): Promise<void>

  async commit(): Promise<void> {
    this.assertEditable()
    await this._commit()
  }
}
