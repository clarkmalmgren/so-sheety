import { docs_v1 } from 'googleapis'
import { CellValue } from '../grid/CellValue'

export function paragraph2text(p: docs_v1.Schema$Paragraph): string {
  const strings: string[] = []
  p.elements?.forEach(e => {
    e.person && strings.push(e.person.personProperties?.name || e.person.personProperties?.email || '{unknown person}')
    e.richLink && strings.push(e.richLink.richLinkProperties?.uri || '{unknown rich link}')
    e.textRun && e.textRun.content && strings.push(e.textRun.content)
  })
  return strings.join(' ').trim()
}

export function structure2text(content: docs_v1.Schema$StructuralElement[]): string {
  const strings: string[] = []
  content.forEach(e => {
    e.paragraph && strings.push(paragraph2text(e.paragraph))
  })
  return strings.filter(s => !!s).join('\n')
}

export function toCellValue(table: docs_v1.Schema$Table, row: number, col: number): CellValue {
  const cell = table.tableRows?.[row].tableCells?.[col]
  if (!cell || !cell.content) { return undefined }
  const txt = structure2text(cell.content)
  const num = +txt

  if (txt === '') {
    return undefined
  } else if (!isNaN(num)) {
    return num
  } else if (txt.toLowerCase() === 'true') {
    return true
  } else if (txt.toLowerCase() === 'false') {
    return false
  } else {
    return txt
  }
}
