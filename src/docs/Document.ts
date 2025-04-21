import { docs_v1, google } from 'googleapis'
import { Auth } from '../Auth'
import { isParagraph, isTable, parseEl } from './refs'
import { ElRef, RefMatcher } from './refs/ElRef'
import { TableRef } from './refs/TableRef'
import { Drive } from '../drive/Drive'

export type HeaderSelector = number | string | ((h: string) => boolean)

function headerSelectorToMatcher(selector: HeaderSelector): RefMatcher {
  return (r: ElRef<any>) => {
    if (!isParagraph(r) || !r.isHeading) { return false }
    
    if (typeof selector === 'function') {
      return selector(r.text)
    } else if (typeof selector === 'number') {
      return r.startIndex >= selector
    } else if (typeof selector === 'string') {
      return r.text === selector
    } else {
      return false
    }
  }
}

export type DocumentMutator = {
  request(r: docs_v1.Schema$Request): void
  commit(): Promise<void>
}

type CommentRequest = {
  // The comment to insert
  comment: string

  // The text quoted by this comment
  quote: string

  // The index of the request in the batch
  requestIndex: number
}

export class Document implements DocumentMutator {

  static async load(id: string, auth: Auth): Promise<Document> {
    const oauth = await auth.authorize()
    const api = google.docs({ version: 'v1', auth: oauth })
    const document = await api.documents.get({ documentId: id })

    return new Document(id, api, auth, document.data)
  }

  private initialized: boolean = false
  private _head?: ElRef<any>
  private _tail?: ElRef<any>
  private updates: docs_v1.Schema$Request[] = []
  private commentRequests: CommentRequest[] = []

  constructor(
    public readonly id: string,
    private api: docs_v1.Docs,
    private auth: Auth,
    private document: docs_v1.Schema$Document
  ) {}

  /**
   * Add a request to the batch.
   * 
   * @param req - The request to add.
   * @returns The index of the request in the batch.
   */
  request(req: docs_v1.Schema$Request): number {
    this.updates.push(req)
    return this.updates.length - 1
  }

  async reload(): Promise<void> {
    this.initialized = false
    this._head = undefined
    this._tail = undefined
    this.updates = []
    this.commentRequests = []

    this.document = await this.api.documents.get({ documentId: this.id })
  }

  get head(): ElRef<any> {
    this.init()
    if (!this._head) { throw new Error('Head not initialized') }
    return this._head
  }

  get tail(): ElRef<any> {
    this.init()
    if (!this._tail) { throw new Error('Tail not initialized') }
    return this._tail
  }

  init(): void {
    if (this.initialized) { return }

    const elements = this.document.body?.content
    if (!elements) { throw new Error('No elements found') }
    let last: ElRef<any> | undefined

    const refs = elements.map(el => {
      let r = parseEl(el, this, last)
      last?.setNext(r)
      last = r
      return r
    })

    this._head = refs[0]
    this._tail = refs[refs.length - 1]

    this.initialized = true
  }

  /**
   * Find the first element that matches the selector.
   * 
   * @param selector - The selector to match.
   * @param reverse - Whether to search in reverse order.
   * @returns The first element that matches the selector, or undefined if no match is found.
   */
  find(selector: RefMatcher, reverse: boolean = false): ElRef<any> | undefined {
    this.init()
    const start = reverse ? this.tail : this.head
    return start.find(selector, reverse)
  }

  /**
   * Find the offset of the first element that matches the selector.
   * 
   * @param selector - The selector to match.
   * @returns The offset of the first element that matches the selector, or undefined if no match is found.
   */
  offset(selector: HeaderSelector): number | undefined {
    this.init()
    const fn = headerSelectorToMatcher(selector)
    return this.head.find(fn)?.startIndex
  }

  firstTableAfter(start: HeaderSelector): TableRef | undefined {
    this.init()
    const startFn = headerSelectorToMatcher(start)

    const firstHeader = this.head.find(startFn)
    if (!firstHeader) { return undefined }

    return firstHeader.next.find(isTable) as TableRef | undefined
  }

  tablesBetween(start: HeaderSelector, end?: HeaderSelector): TableRef[] {
    this.init()

    const startFn = headerSelectorToMatcher(start)
    const endFn: RefMatcher =
      typeof end === 'undefined' ? () => false : headerSelectorToMatcher(end)
    
    let tables: TableRef[] = []
    for (let ref = this.head.find(startFn); ref && !endFn(ref); ref = ref.next) {
      if (isTable(ref)) {
        tables.push(ref)
      }
    }

    return tables
  }

  comment(text: string, quote: string, start: number, end: number): void {
    this.init()

    const requestIndex = this.request({
      createNamedRange: {
        name: `comment_${start}-${end}`,
        range: { startIndex: start, endIndex: end }
      }
    })

    this.commentRequests.push({ comment: text, quote, requestIndex })
  }

  async commit(): Promise<void> {
    this.init()
    if (this.updates.length === 0) { return }

    const resp = await this.api.documents.batchUpdate({
      documentId: this.id,
      requestBody: { requests: this.updates }
    })

    if (this.commentRequests.length > 0) {
      const fileId = this.document.documentId
      const drive = await Drive.load(this.auth)
      if (!resp.data.replies) {
        throw new Error(`Replies was empty`)
      }

      for (const req of this.commentRequests) {
        if (!fileId) { throw new Error('Document ID not found') }

        const range = resp.data.replies[req.requestIndex]?.createNamedRange
        if (!range) { throw new Error(`Range not found, comment unable to be created`) }
        if (!range.namedRangeId) { throw new Error(`Named range ID not found, comment unable to be created`) }
        
        drive.createComment(fileId, req.comment, req.quote, range.namedRangeId)
      }
    }

    this.updates = []
    this.commentRequests = []
  }

}
