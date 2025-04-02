import { docs_v1 } from 'googleapis'
import { CellValue, isLink } from '../grid/CellValue'
import { Grid, RowObject } from '../grid/Grid'
import { Row } from '../grid/Row'
import { CellLocation, FutureCellLocation, toCellLocation } from './CellLocation'
import { toCellValue } from './converters'
import { DocumentMutator } from './Document'

type CellLocations = (CellLocation | undefined)[][]

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

export class Table extends Grid {

  static parse(table: docs_v1.Schema$Table, frozenRowCount: number, startIndex: number, endIndex: number, mutator: DocumentMutator): Table {
    const rows = table.rows
    const cols = table.columns

    if (!rows || !cols) {
      throw new Error(`Table is empty, can't load a table of size ${rows}x${cols}`)
    }

    const allData: CellValue[][] = arr2d(rows, cols, (r, c) => toCellValue(table, r, c))
    const cells: CellLocations = arr2d(rows, cols, (r, c) => toCellLocation(table, r, c))
    
    return new Table(allData, frozenRowCount, startIndex, endIndex, mutator, cells)
  } 

  protected readonly editable: boolean = true

  constructor(
    allData: CellValue[][],
    frozenRowCount: number,
    private readonly startIndex: number,
    private readonly endIndex: number,
    private readonly mutator: DocumentMutator,
    private readonly cells: CellLocations
  ) {
    super(allData, frozenRowCount)
  }

  protected _set(row: number, col: number, value: CellValue): void {
    if (row >= this.length) {
      throw new Error(`Row ${row} is outside the current size of the table. For document tables, you must add rows first before editing`)
    }

    const cell = this.cells[row + this.frozenRowCount][col]
    if (!cell) {
      throw new Error(`Couldn't find cell at [${row}, ${col}]`)
    }

    const text = isLink(value) ? value.text : `${value}`

    const delta = this.mutator.getOffset(cell.start)
    const originalStartIndex = cell.start + 1
    const startIndex = originalStartIndex + delta + cell.delta
    const length = cell.end - cell.start - 2

    // Delete the existing content if is not empty (2 bytes is an empty cell)
    if (cell.end - cell.start > 2) {
      this.mutator.request(
        {
          deleteContentRange: {
            range: { startIndex, endIndex: startIndex + length }
          }
        },
        {
          index: originalStartIndex,
          delta: -length
        }
      )
    }

    // Add the text and update the cell size (required for future cells to keep track of offsets)
    cell.size = text.length
    this.mutator.request(
      {
        insertText: {
          location: { index: startIndex },
          text
        }
      },
      {
        index: originalStartIndex,
        delta: text.length
      }
    )
    
    // If it is a link, we have to update the style in addition to inserting the text
    if (isLink(value)) {
      this.mutator.request({
        updateTextStyle: {
          range: { startIndex, endIndex: startIndex + text.length },
          fields: 'link',
          textStyle: {
            link: { url: value.url }
          }
        }
      })
    }
  }

  override append(obj: RowObject = {}): Row {
    const delta = this.mutator.getOffset(this.startIndex)
    const startIndex = this.startIndex + delta

    this.mutator.request(
      {
        insertTableRow: {
          insertBelow: true,
          tableCellLocation: {
            tableStartLocation: { index: startIndex },
            rowIndex: this.cells.length - 1
          }
        }
      },
      {
        index: this.endIndex,
        // To calculate the number of bytes in the empty row, 1 for the row, 2 for each cell
        delta: 1 + this.cells[0].length * 2
      }
    )

    // The table's end index is the new cells start index for everything
    // also, get the last cell because it might be a future and thus this row is also relative
    const lastCell = this.cells[this.cells.length - 1][this.cells[0].length - 1]
    if (!lastCell) { throw new Error(`Couldn't find last cell`) }

    let lastFuture: FutureCellLocation | undefined = lastCell.future ? lastCell as FutureCellLocation : undefined

    const offsets: FutureCellLocation[] =
      arr(this.cells[0].length, (i) => {
        const next = new FutureCellLocation(this.endIndex, i === 0, lastFuture)
        lastFuture = next
        return next
      })

    this.cells.push(offsets)

    // Add the empty row to the data
    this.data.push([])

    const row = this.row(this.data.length - 1)
    row.setObj(obj)
    return row
  }

  protected _commit(): Promise<void> {
    return this.mutator.commit()
  }

}
