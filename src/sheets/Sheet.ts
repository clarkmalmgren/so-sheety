import { sheets_v4 } from 'googleapis'
import { CellValue } from '../grid/CellValue'
import { Grid } from '../grid/Grid'
import { cellsOf, toCellData } from './converters'

export class Sheet extends Grid {

  private readonly sheetId: number | null | undefined
  private filledRows: number
  private totalRows: number
  protected readonly editable: boolean = true

  private updates: sheets_v4.Schema$Request[] = []

  constructor(
    private readonly api: sheets_v4.Resource$Spreadsheets,
    private readonly spreadsheetId: string,
    sheet: sheets_v4.Schema$Sheet
  ) {
    const frozenRowCount = sheet.properties?.gridProperties?.frozenRowCount || 0
    const totalRows = sheet.properties?.gridProperties?.rowCount || 0
    
    const rows = sheet.data?.[0]?.rowData
    if (!rows) { throw new Error(`Sheet doesn't have any data`) }
    if (!totalRows) { throw new Error(`Sheet claims to have no rows`) }
    
    const allData = cellsOf(rows)
    super(allData, frozenRowCount)

    this.sheetId = sheet.properties?.sheetId
    this.filledRows = allData.length
    this.totalRows = totalRows
  }

  protected _set(row: number, col: number, value: CellValue): void {
    const _row = row + this.frozenRowCount
    this.updates.push({ updateCells: {
      range: {
        sheetId: this.sheetId,
        startRowIndex: _row,
        endRowIndex: _row + 1,
        startColumnIndex: col,
        endColumnIndex: col + 1
      },
      rows: [ { values: [ toCellData(value) ] } ],
      fields: 'userEnteredValue,userEnteredFormat'
    }})
  }

  protected async _commit(): Promise<void> {
    const req: sheets_v4.Schema$Request[] = []

    // Check to see if we have to append rows first
    const buffer = this.totalRows - this.filledRows
    if (this.appends > buffer) {
      req.push({ appendCells: {
        sheetId: this.sheetId,
        rows: Array(this.appends).fill({ values: [ toCellData('') ]}),
        fields: 'userEnteredValue,userEnteredFormat'
      }})

      this.filledRows += this.appends
      this.totalRows = this.filledRows
    } else {
      this.filledRows += this.appends
    }

    req.push(...this.updates)
    this.appends = 0
    this.updates = []

    if (req.length === 0) {
      return
    }

    await this.api.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: req },
    })
  }

}
