import { google, sheets_v4 } from 'googleapis'
import { Sheet } from './Sheet'
import { Auth } from '../Auth'

export class Spreadsheet {

  static async load(auth: Auth, id: string): Promise<Spreadsheet> {
    const oauth = await auth.authorize()
    const api = google.sheets({ version: 'v4', auth: oauth })

    const spreadsheet = await api.spreadsheets.get({ spreadsheetId: id, includeGridData: true })
    return new Spreadsheet(api.spreadsheets, spreadsheet.data, id)
  }

  constructor(
    readonly api: sheets_v4.Resource$Spreadsheets,
    readonly spreadsheet: sheets_v4.Schema$Spreadsheet,
    readonly id: string
  ) {}

  sheet(name: string): Sheet {
    const sheet = this.spreadsheet.sheets?.find(s => s.properties?.title === name)
    if (!sheet) { throw new Error(`Spreadsheet didn't have a ${name} sheet`) }
    return new Sheet(this.api, this.spreadsheet.spreadsheetId as string, sheet)
  }

  get title(): string {
    return this.spreadsheet.properties?.title || 'UNKNOWN TITLE'
  }
}
