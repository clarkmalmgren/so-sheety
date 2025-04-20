import { docs_v1 } from 'googleapis'
import { DocumentMutator } from '../Document'
import { BulletStyle, ParagraphStyle, TextStyle, toGoogleParagraphStyle, toGoogleTextStyle } from '../styles'
import { ElRef, ElTypeName } from './ElRef'

export type StyledText = { text: string, style: TextStyle }
export type Span = StyledText | string

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

class SpanRef {

  private readonly: boolean
  private size: number

  constructor(
    public el: docs_v1.Schema$ParagraphElement,
    private prev?: SpanRef
  ) {
    if (typeof el.startIndex !== 'number' || typeof el.endIndex !== 'number') {
      throw new Error('TextRef must have a startIndex and endIndex')
    }

    if (el.richLink) {
      this.readonly = true
    } else if (this.text.length !== (el.endIndex - el.startIndex)) {
      throw new Error('Text length must match the difference between startIndex and endIndex')
    } else {
      this.readonly = false
    }

    this.size = el.endIndex - el.startIndex
  }

  getPrev(): SpanRef | undefined {
    return this.prev
  }

  setPrev(prev: SpanRef): void {
    this.prev = prev
  }

  get formattedText(): string {
    if (this.el.textRun) {
      return this.text
    } else if (this.el.person) {
      return this.el.person.personProperties?.name || this.el.person.personProperties?.email || '{unknown person}'
    } else if (this.el.richLink) {
      return this.el.richLink.richLinkProperties?.title || this.el.richLink.richLinkProperties?.uri || '{unknown rich link}'
    } else {
      return ''
    }
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

  get endOffset(): number {
    return this.offset + this.length
  }
  
  match(matcher: RegExp | string): RegExpMatchArray | null {
    return match(matcher, this.text)
  }

  split(offset: number): SpanRef[] {
    const first = new SpanRef({ textRun: { content: this.text.slice(0, offset) }, startIndex: 0, endIndex: offset }, this.prev)
    const second = new SpanRef({ textRun: { content: this.text.slice(offset) }, startIndex: offset, endIndex: this.length }, first)
    return [ first, second ]
  }
}

export class ParagraphRef extends ElRef<docs_v1.Schema$Paragraph> {
  public readonly type: ElTypeName = 'paragraph'

  private _spans: SpanRef[] = []

  constructor(
    el: docs_v1.Schema$Paragraph,
    startIndex: number,
    endIndex: number,
    mutator: DocumentMutator,
    prev?: ElRef<any>
  ) {
    super(el, startIndex, endIndex, mutator, prev)

    let last: SpanRef | undefined = undefined
    this._spans = this.el.elements?.map(e => new SpanRef(e, last)) || []
  }

  get text(): string {
    return this._spans.map(s => s.formattedText).join('').replace(/\n$/g, '')
  }

  get isHeading(): boolean {
    return !!this.el.paragraphStyle?.headingId
  }

  match(matcher: RegExp | string): RegExpMatchArray | null {
    return match(matcher, this.text)
  }

  matches(matcher: RegExp | string): boolean {
    return !!this.match(matcher)
  }

  replace(matcher: RegExp | string, ...updated: Span[]): boolean {
    const found = this._spans.find(s => s.match(matcher))
    const match = found?.match(matcher)

    // Check for various no-ops
    if (!found || !match || typeof match.index !== 'number') { return false }

    const offset = match.index
    const length = match[0].length
    const start = found.offset + offset
    const startIndex = this.startIndex + start

    if (length > 0) {
      this.mutator.request({
        deleteContentRange: {
          range: { startIndex: startIndex, endIndex: startIndex + length }
        }
      })
    }

    const next = found.text.slice(0, offset) + found.text.slice(offset + length)
    found.text = next
    this._size = this._spans.reduce((acc, s) => acc + s.length, 0)

    this.insert(start, ...updated)
    return true
  }

  replaceAll(...spans: Span[]): void {
     /*  Replace EVERYTHING except for the trailing \n */
     if (this._size > 1) {
      this.mutator.request({
        deleteContentRange: {
          range: { startIndex: this.startIndex, endIndex: this.startIndex + this._size - 1 }
        }
      })
    }

    this._spans = [ new SpanRef({ textRun: { content: '\n' }, startIndex: 0, endIndex: 1 }) ]
    this._size = 1

    this.insert(0, ...spans)
  }

  style(style: ParagraphStyle): void {
    this.mutator.request({
      updateParagraphStyle: {
        fields: Object.keys(style).join(','),
        paragraphStyle: toGoogleParagraphStyle(style),
        range: { startIndex: this.startIndex, endIndex: this.startIndex + this._size }
      }
    })
  }

  private getStyleRequests(style: TextStyle, start?: number, end?: number): docs_v1.Schema$Request {
    return {
      updateTextStyle: {
        fields: Object.keys(style).join(','),
        textStyle: toGoogleTextStyle(style),
        range: {
          startIndex: this.startIndex + (start || 0),
          endIndex: this.startIndex + (end || this._size)
        }
      }
    }
  }

  /**
   * Styles the text of the paragraph.
   * 
   * @param style - The style to apply to the text.
   * @param start - The start index of the text to style as the number of characters from the start of the paragraph. If excluded, it will be from the beginning of the paragraph.
   * @param end - The end index of the text to style.
   */
  styleText(style: TextStyle, start?: number, end?: number): void {
    this.mutator.request(this.getStyleRequests(style, start, end))
  }

  bullet(style: BulletStyle): void {
    this.mutator.request({
      createParagraphBullets: {
        bulletPreset: style,
        range: {
          startIndex: this.startIndex,
          endIndex: this.startIndex + this._size - 1
        }
      }
    })
  }

  /**
   * Inserts a new paragraph after this paragraph but keeps it in the same paragraph style. It is important
   * to note that the new paragraph will have the same paragraph style as the previous paragraph. This allows
   * for continuing a list.
   * 
   * @param spans - The span(s) to insert.
   * @returns The new paragraph.
   */
  insertParagraph(...spans: Span[]): ParagraphRef {
    // First we insert the text
    this.mutator.request({
      insertText: {
        location: { index: this.startIndex + this._size - 1 },
        text: '\n'
      }
    })

    // Then we create the new paragraph for organization
    const next = new ParagraphRef(this.el, 0, 0, this.mutator)
    const span = new SpanRef({ textRun: { content: '\n' }, startIndex: 0, endIndex: 1 })
    next._spans = [ span ]
    next._size = 1

    next.setPrev(this)
    next.setNext(this.next)
    this.next.setPrev(next)
    this.setNext(next)

    next.append(...spans)

    return next
  }

  insert(offset: number, ...spans: Span[]): void {
    let index = this._spans.findIndex(s => s.offset <= offset && offset < s.endOffset)
    let next = this._spans[index]

    if (next.offset !== offset) {
      const split = next.split(offset - next.offset)
      this._spans[index + 1]?.setPrev(split[1])
      this._spans.splice(index, 1, ...split)

      next = split[1]
      index += 1
    }
    
    const textRequests: docs_v1.Schema$Request[] = []
    const styleRequests: docs_v1.Schema$Request[] = []

    spans
      .map(s => typeof s === 'string' ? { text: s, style: undefined } : s)
      .filter(({ text }) => text.length > 0)
      .forEach(({ text, style }) => {
        const start = next.offset
        const end = start + text.length

        textRequests.push({
          insertText: { location: { index: this.startIndex + start }, text }
        })

        if (style && Object.keys(style).length > 0) {
          styleRequests.push(this.getStyleRequests(style, start, end))
        }

        const created = new SpanRef({
          textRun: { content: text },
          startIndex: 0,
          endIndex: text.length
        }, next.getPrev())

        next.setPrev(created)
        this._spans.splice(index, 0, created)

        index += 1
      })
      
    this._size = this._spans.reduce((acc, s) => acc + s.length, 0)

    // Then we apply styles
    textRequests.forEach(r => this.mutator.request(r))
    styleRequests.forEach(r => this.mutator.request(r))
  }

  append(...spans: Span[]): void {
    this.insert(this._size - 1, ...spans)
  }
}
