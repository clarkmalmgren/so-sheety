import { CellValue, cellValuesEqual, isLink } from './CellValue'
import { ColumnLocator, Grid, RowObject } from './Grid'

export class Row {

  constructor(
    private readonly grid: Grid,
    private readonly offset: number
  ) {}

  obj(): RowObject {
    return this.grid.obj(this.offset)
  }

  value(col: ColumnLocator): CellValue {
    return this.grid.get(this.offset, col)
  }

  eq(col: ColumnLocator, other: CellValue): boolean {
    const a = this.value(col)
    return cellValuesEqual(a, other)
  }

  isDefined(col: ColumnLocator): boolean {
    return !!this.value(col)
  }

  string(col: ColumnLocator, _default: string = ''): string {
    return (this.value(col) || _default).toString()
  }

  num(col: ColumnLocator, _default: number = 0): number {
    const actual = +(this.value(col) as number)
    return (typeof actual === 'number') ? actual : _default
  }

  stringArray(col: ColumnLocator): string[] {
    return this.string(col).toString().split('\n').map(s => s?.trim()).filter(s => !!s)
  }

  link(col: ColumnLocator): string | undefined {
    const v = this.value(col)
    return isLink(v) ? v.url : undefined
  }

  driveLinkId(col: ColumnLocator): string | undefined {
    return this.link(col)?.split(/\/+/)?.[4]
  }

  set(col: ColumnLocator, val: CellValue): void {
    this.grid.set(this.offset, col, val)
  }

  setObj(obj: RowObject): void {
    Object.keys(obj).forEach(k => this.set(k, obj[k]))
  }

  delete(): void {
    this.grid.delete(this.offset)
  }
}
