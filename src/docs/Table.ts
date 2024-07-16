import { docs_v1 } from 'googleapis'
import { CellValue } from '../grid/CellValue'
import { Grid } from '../grid/Grid'
import { toCellValue } from './converters'

function arr<T>(len: number, fn: (i: number) => T): T[] {
  const a: T[] = []
  for (let i = 0; i < len; i++) {
    a.push(fn(i))
  }
  return a
}

export class Table extends Grid {

  static parse(table: docs_v1.Schema$Table, frozenRowCount: number): Table {
    const rows = table.rows
    const cols = table.columns

    if (!rows || !cols) {
      throw new Error(`Table is empty, can't load a table of size ${rows}x${cols}`)
    }

    const allData: CellValue[][] = arr(rows, row => arr(cols, col => toCellValue(table, row, col)))
    
    return new Table(allData, frozenRowCount)
  }

  protected readonly editable: boolean = false

  constructor(allData: CellValue[][], frozenRowCount: number) {
    super(allData, frozenRowCount)
  }

  protected _set(row: number, col: number, value: CellValue): void {
    throw new Error('Method not implemented.')
  }

  protected _commit(): Promise<void> {
    throw new Error('Method not implemented.')
  }

}
