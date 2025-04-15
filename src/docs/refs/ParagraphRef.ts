import { docs_v1 } from 'googleapis'
import { ElRef, ElTypeName } from './ElRef'
import { spans2text } from '../converters'

function match(matcher: RegExp | string, input: string): RegExpMatchArray | null {
  if (typeof matcher === 'string') {
    const index = input.indexOf(matcher)
    if (index < 0) { return null }
    const match: RegExpMatchArray = [ matcher ]
    match.index = index
    match.input = input
    return match
  }

  return input.match(matcher)
}

class Span {

  private readonly: boolean
  private size: number

  constructor(
    public el: docs_v1.Schema$ParagraphElement,
    private readonly prev?: Span
  ) {
    if (!el.startIndex || !el.endIndex) {
      throw new Error('TextRef must have a startIndex and endIndex')
    }

    if (el.richLink) {
      this.readonly = true
    } else if (this.text.length !== (el.endIndex - el.startIndex)) {
      throw new Error('TextRef must be initialized with a startIndex and endIndex')
    } else {
      this.readonly = false
    }

    this.size = el.endIndex - el.startIndex
  }

  get text(): string {
    return this.el.textRun?.content || ''
  }

  set text(value: string) {
    if (this.readonly) {
      throw new Error('Cannot set text on a readonly span')
    }

    if (this.el.textRun) {
      this.el.textRun.content = value
    } else {
      this.el.textRun = { content: value }
    }

    this.size = value.length
  }
  
  get length(): number {
    return this.size
  }

  get offset(): number {
    return this.prev ? this.prev.offset + this.prev.length : 0
  }
  
  match(matcher: RegExp | string): RegExpMatchArray | null {
    return match(matcher, this.text)
  }
}

export class ParagraphRef extends ElRef<docs_v1.Schema$Paragraph> {
  public readonly type: ElTypeName = 'paragraph'

  private _spans: Span[] = []

  private init(): void {
    if (this._spans.length > 0) { return }
    let last: Span | undefined = undefined
    this._spans = this.el.elements?.map(e => new Span(e, last)) || []
  }

  get text(): string {
    this.init()
    return spans2text(this.el.elements || [])
  }

  get isHeading(): boolean {
    return !!this.el.paragraphStyle?.headingId
  }

  match(matcher: RegExp | string): RegExpMatchArray | null {
    this.init()
    return match(matcher, this.text)
  }

  matches(matcher: RegExp | string): boolean {
    return !!this.match(matcher)
  }

  replace(matcher: RegExp | string, updated: string): boolean {
    this.init()

    const found = this._spans.find(s => s.match(matcher))
    const match = found?.match(matcher)

    // Check for various no-ops
    if (!found || !match || typeof match.index !== 'number') { return false }
    if (updated === match[0]) { return false }

    const offset = match.index
    const length = match[0].length
    const startIndex = this.startIndex + found.offset + offset

    if (length > 0) {
      this.mutator.request({
        deleteContentRange: {
          range: { startIndex: startIndex, endIndex: startIndex + length }
        }
      })
    }

    if (updated.length > 0) {
      this.mutator.request({
        insertText: {
          location: { index: startIndex },
          text: updated
        }
      })
    }

    const next = found.text.slice(0, offset) + updated + found.text.slice(offset + length)
    found.text = next

    this._size = this._spans.reduce((acc, s) => acc + s.length, 0)
    return true
  }

  replaceAll(updated: string): void {
    this.init()
     /*  Replace EVERYTHING except for the trailing \n */
     if (this._size > 1) {
      this.mutator.request({
        deleteContentRange: {
          range: { startIndex: this.startIndex, endIndex: this.startIndex + this._size - 1 }
        }
      })
    }
    
    if (updated.length > 0) {
      this.mutator.request({
        insertText: {
        location: { index: this.startIndex },
        text: updated
        }
      })
    }

    const span = this._spans[this._spans.length - 1]
    span.text = updated + '\n'

    this._spans = [ span ]
    this._size = span.text.length
  }
}
