import { docs_v1, google } from 'googleapis'
import { Auth } from '../Auth'
import { paragraph2text } from './converters'
import { Table } from './Table'

export type HeaderSelector = number | string | ((h: string) => boolean)

export class TableRef {

  private _loaded: { [frozen: number]: Table } = {}
  
  constructor(
    readonly offset: number,
    private readonly source: docs_v1.Schema$Table
  ) {}

  load(frozenRowCount: number = 0): Table {
    const found = this._loaded[frozenRowCount]
    if (found) {
      return found
    }

    const made = Table.parse(this.source, frozenRowCount)
    this._loaded[frozenRowCount] = made
    return made
  }
}

export class Document {

  static async load(id: string, auth: Auth): Promise<Document> {
    const oauth = await auth.authorize()
    const api = google.docs({ version: 'v1', auth: oauth })
    const document = await api.documents.get({ documentId: id })
    
    const tables: TableRef[] = []
    const headers: { [title: string]: number } = {}

    document.data.body
      ?.content
      ?.forEach(el => {
        if (!el.startIndex) { return }

        if (el.table) {
          tables.push(new TableRef(el.startIndex, el.table))
        } else if (el.paragraph && el.paragraph.paragraphStyle?.headingId) {
          headers[paragraph2text(el.paragraph)] = el.startIndex
        }
      })


    return new Document(tables, headers)
  }

  constructor(
    private readonly tables: TableRef[],
    private readonly headers: { [title: string]: number }
  ) {
    this.tables.sort((a, b) => a.offset - b.offset)
  }

  offset(selector: HeaderSelector): number | undefined {
    if (typeof selector === 'function') {
      const h = Object.keys(this.headers).find(selector)
      return (typeof h === 'undefined') ? undefined : this.headers[h]
    } else if (typeof selector === 'number') {
      return selector
    } else {
      return this.headers[selector]
    }
  }

  firstTableAfter(start: HeaderSelector): TableRef | undefined {
    const off = this.offset(start)
    if (typeof off === 'undefined') { return undefined }
    return this.tables.find(t => t.offset > off)
  }

  tablesBetween(start: HeaderSelector, end?: HeaderSelector): TableRef[] {
    const startOff = this.offset(start)
    const endOff = typeof end === 'undefined' ? undefined : this.offset(end)

    if (typeof startOff === 'undefined') {
      return []
    }

    return this.tables.filter(t => t.offset > startOff && (typeof endOff === 'undefined' || t.offset < endOff))
  }

}
