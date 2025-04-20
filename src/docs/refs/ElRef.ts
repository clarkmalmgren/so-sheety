import { docs_v1 } from 'googleapis'
import { DocumentMutator } from '../Document'
import { Table } from '../Table'
import { TableRef } from './TableRef'

type ElInnerTypes =
  | docs_v1.Schema$Paragraph
  | docs_v1.Schema$SectionBreak
  | docs_v1.Schema$Table
  | docs_v1.Schema$TableOfContents

export type ElTypeName = 'paragraph' | 'break' | 'table' | 'toc'

export type RefMatcher = (r: ElRef<any>) => boolean

export abstract class ElRef<T extends ElInnerTypes> {

  protected _next?: ElRef<any>
  protected _prev?: ElRef<any>
  protected _size: number

  public abstract readonly type: ElTypeName

  constructor(
    readonly el: T,
    readonly initialStartIndex: number,
    readonly initialEndIndex: number,
    readonly mutator: DocumentMutator,
    prev?: ElRef<any>,
  ) {
    this._size = initialEndIndex - initialStartIndex
    this._prev = prev
  }

  get prev(): ElRef<any> | undefined {
    return this._prev
  }

  get next(): ElRef<any> {
    if (!this._next) { throw new Error('Next not set') }
    return this._next
  }

  setNext(next: ElRef<any>): void {
    this._next = next 
  }

  setPrev(prev: ElRef<any>): void {
    this._prev = prev
  }

  /**
   * Find the first element that matches the selector.
   * 
   * @param selector - The selector to match.
   * @param reverse - Whether to search in reverse order.
   * @returns The first element that matches the selector, or undefined if no match is found.
   */
  find(selector: RefMatcher, reverse: boolean = false): ElRef<any> | undefined {
    let ref: ElRef<any> | undefined = this
    while (ref) {
      if (selector(ref)) { return ref }
      ref = reverse ? ref._prev : ref._next
    }
    return undefined
  }

  get startIndex(): number {
    return !!this.prev ? this.prev.endIndex : this.initialStartIndex
  }

  get endIndex(): number {
    return this.startIndex + this._size
  }

  insertBefore<T extends ElRef<any>>(ref: T): T {
    ref._prev = this._prev
    ref._next = this
    this._prev = ref
    if (ref._prev) { ref._prev._next = ref }
    
    ref.initialize()

    return ref
  }

  initialize(): void {
    throw new Error('Not implemented/allowed')
  }

  delete(): void {
    this.mutator.request({
      deleteContentRange: {
        range: { startIndex: this.startIndex, endIndex: this.endIndex }
      }
    })
    this._size = 0
  }

}

export class BreakRef extends ElRef<docs_v1.Schema$SectionBreak> {
  public readonly type: ElTypeName = 'break'
}

export class TableOfContentsRef extends ElRef<docs_v1.Schema$TableOfContents> {
  public readonly type: ElTypeName = 'toc'
}
