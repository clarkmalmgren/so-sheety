import { docs_v1 } from 'googleapis'
import { Table } from '../Table'
import { ElRef, ElTypeName } from './ElRef'
import { DocumentMutator } from '../Document'
import { CellValue } from '../../grid/CellValue'

export type TableRefControls = {
  startIndex: () => number
  endIndex: () => number
  setSize: (size: number) => void
  mutator: DocumentMutator
}

export class TableRef extends ElRef<docs_v1.Schema$Table> {
  public readonly type: ElTypeName = 'table'
  protected _loaded?: Table

  readonly controls: TableRefControls = {
    startIndex: () => this.startIndex,
    endIndex: () => this.endIndex,
    setSize: (size: number) => { this._size = size },
    mutator: this.mutator
  }

  load(frozenRowCount: number = 0): Table {
    if (!this._loaded) {
      this._loaded = Table.parse(this.el, frozenRowCount, this.controls)
      return this._loaded
    } else if (this._loaded.frozenRowCount !== frozenRowCount) {
      throw new Error('Table frozen row count mismatch')
    } else {
      return this._loaded
    }
  }
}

export class LazyTableRef extends TableRef {

  private _initialized: boolean = false

  constructor(private readonly headers: CellValue[], mutator: DocumentMutator) {
    super({}, 0, 0, mutator)
  }

  override readonly controls: TableRefControls = {
    startIndex: () => this.startIndex + 1, // For some reason, when the table is inserted, it's start index is one further than normal
    endIndex: () => this.endIndex,
    setSize: (size: number) => { this._size = size + 1 },
    mutator: this.mutator
  }

  override initialize(): Table {
    if (this._initialized) { throw new Error(`Table already initialized, can't insert more than once`) }
    if (this._loaded) { throw new Error('Table already loaded') }

    this.mutator.request({
      insertTable: {
        location: { index: this.startIndex },
        rows: 1,
        columns: this.headers.length
      }
    })

    this._loaded = Table.create(this.headers, this.controls)
    this._initialized = true
    return this._loaded
  }

  override load(frozenRowCount?: number): Table {
    if (!this._initialized) { throw new Error('Table not initialized') }
    return super.load(frozenRowCount)
  }
}