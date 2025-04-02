import { docs_v1 } from 'googleapis'


export type CellLocation = {
  start: number
  end: number
  delta: number
  size: number
  readonly future: boolean
}

export class BasicCellLocation implements CellLocation {

  readonly future: boolean = false

  constructor(
    public readonly start: number,
    public readonly end: number,
    public readonly delta: number,
    public size: number
  ) {}

}

export class FutureCellLocation implements CellLocation {

  readonly future: boolean = true

  constructor(
    public readonly start: number,
    public readonly firstInRow: boolean,
    public readonly after?: FutureCellLocation,
    public size: number = 0
  ) {}

  get end(): number {
    return this.start + this.size + 2
  }
  
  get delta(): number {
    if (this.after) {
      return this.after.delta + this.after.size + (this.firstInRow ? 3 : 2)
    } else if (!this.firstInRow) {
      throw new Error('The first future cell must be the first in a row')
    } else {
      return 0
    }
  }
}


export function toCellLocation(table: docs_v1.Schema$Table, row: number, col: number): CellLocation | undefined {
  const cell = table.tableRows?.[row].tableCells?.[col]
  if (!cell || !cell.content || typeof cell.startIndex !== 'number' || typeof cell.endIndex !== 'number') { return undefined }
  
  return new BasicCellLocation(cell.startIndex, cell.endIndex, 0, cell.endIndex - cell.startIndex - 2)
}
