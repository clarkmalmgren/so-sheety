import { docs_v1 } from 'googleapis'
import { DocumentMutator } from '../Document'
import { BreakRef, ElRef, TableOfContentsRef } from './ElRef'
import { ParagraphRef } from './ParagraphRef'
import { TableRef } from './TableRef'

export function parseEl(el: docs_v1.Schema$StructuralElement, mutator: DocumentMutator, prev?: ElRef<any>): ElRef<any> {
  if (!el.endIndex) {
    throw new Error('No end index')
  } else if (!el.startIndex && prev) {
    throw new Error('Start index missing on non-first element')
  }

  const startIndex = el.startIndex || prev?.endIndex || 0

  if (el.paragraph) {
    return new ParagraphRef(el.paragraph, startIndex, el.endIndex, mutator, prev)
  } else if (el.sectionBreak) {
    return new BreakRef(el.sectionBreak, startIndex, el.endIndex, mutator, prev)
  } else if (el.table) {
    return new TableRef(el.table, startIndex, el.endIndex, mutator, prev)
  } else if (el.tableOfContents) {
    return new TableOfContentsRef(el.tableOfContents, startIndex, el.endIndex, mutator, prev)
  } else {
    throw new Error("Unknown element type")
  }
}

export function isParagraph(el: ElRef<any>): el is ParagraphRef {
  return el.type === 'paragraph'
}

export function isTable(el: ElRef<any>): el is TableRef {
  return el.type === 'table'
}

export function isBreak(el: ElRef<any>): el is BreakRef {
  return el.type === 'break'
}

export function isToc(el: ElRef<any>): el is TableOfContentsRef {
  return el.type === 'toc'
}
