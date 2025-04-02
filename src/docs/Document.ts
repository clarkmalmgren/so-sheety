import { docs_v1, google } from 'googleapis'
import { Auth } from '../Auth'
import { paragraph2text } from './converters'
import { Table } from './Table'

export type HeaderSelector = number | string | ((h: string) => boolean)

export type OffsetChange = {
  index: number
  delta: number
}

export type DocumentMutator = {
  request(r: docs_v1.Schema$Request, offset?: OffsetChange): void
  commit(): Promise<void>
  getOffset(index: number): number
}


export class TableRef {

  private _loaded: { [frozen: number]: Table } = {}
  
  constructor(
    readonly offset: number,
    private readonly source: docs_v1.Schema$Table,
    private readonly startIndex: number,
    private readonly endIndex: number,
    private readonly mutator: DocumentMutator
  ) {}

  load(frozenRowCount: number = 0): Table {
    const found = this._loaded[frozenRowCount]
    if (found) {
      return found
    }

    const made = Table.parse(this.source, frozenRowCount, this.startIndex, this.endIndex, this.mutator)
    this._loaded[frozenRowCount] = made
    return made
  }
}

export class Document implements DocumentMutator {

  static async load(id: string, auth: Auth): Promise<Document> {
    const oauth = await auth.authorize()
    const api = google.docs({ version: 'v1', auth: oauth })
    const document = await api.documents.get({ documentId: id })

    return new Document(id, api, document.data)
  }

  private initialized: boolean = false
  private tables: TableRef[] = []
  private headers: { [title: string]: number } = {}
  private updates: docs_v1.Schema$Request[] = []
  private offsets: OffsetChange[] = []

  constructor(
    public readonly id: string,
    private api: docs_v1.Docs,
    private document: docs_v1.Schema$Document
  ) {}

  request(req: docs_v1.Schema$Request, off?: OffsetChange): void {
    this.updates.push(req)
    if (off) {
      this.offsets.push(off)
      this.offsets.sort((a, b) => a.index - b.index)
    }
  }
  
  getOffset(index: number): number {
    return this.offsets.filter(o => o.index < index).reduce((acc, o) => acc + o.delta, 0)
  }

  async reload(): Promise<void> {
    this.initialized = false
    this.tables = []
    this.headers = {}
    this.updates = []
    
    this.document = await this.api.documents.get({ documentId: this.id })
  }

  init(): void {
    if (this.initialized) { return }

    this.document.body
      ?.content
      ?.forEach(el => {
        if (!el.startIndex || !el.endIndex) { return }

        if (el.table) {
          this.tables.push(new TableRef(el.startIndex, el.table, el.startIndex, el.endIndex, this))
        } else if (el.paragraph && el.paragraph.paragraphStyle?.headingId) {
          this.headers[paragraph2text(el.paragraph)] = el.startIndex
        }
      })

    this.tables.sort((a, b) => a.offset - b.offset)
    this.initialized = true
  }

  offset(selector: HeaderSelector): number | undefined {
    this.init()
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
    this.init()
    const off = this.offset(start)
    if (typeof off === 'undefined') { return undefined }
    return this.tables.find(t => t.offset > off)
  }

  tablesBetween(start: HeaderSelector, end?: HeaderSelector): TableRef[] {
    this.init()
    const startOff = this.offset(start)
    const endOff = typeof end === 'undefined' ? undefined : this.offset(end)

    if (typeof startOff === 'undefined') {
      return []
    }

    return this.tables.filter(t => t.offset > startOff && (typeof endOff === 'undefined' || t.offset < endOff))
  }

  async commit(): Promise<void> {
    this.init()

    await this.api.documents.batchUpdate({
      documentId: this.id,
      requestBody: { requests: this.updates }
    })

    this.updates = []
  }

}
