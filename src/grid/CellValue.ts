
export type Link = { url: string, text: string }
export type CellValue = string | number | boolean | undefined | Link

export function isLink(v: CellValue): v is Link {
  const ml = v as Link
  return typeof ml?.url !== 'undefined'
}

function trimRow(cells: CellValue[]): CellValue[] {
  let i: number = cells.length - 1
  while (i > -1 && typeof cells[i] === 'undefined') { i-- }
  return cells.slice(0, i + 1)
}

export function trimGrid(grid: CellValue[][]): CellValue[][] {
  const rows = grid.map(trimRow)
  let i: number = rows.length - 1
  while (i > -1 && rows[i].length === 0) { i-- }
  return rows.slice(0, i + 1)
}

function isEmpty(v: CellValue): boolean {
  return (typeof v === 'undefined') ? true : v === ''
}

export function cellValuesEqual(a: CellValue, b: CellValue, loose: boolean = false): boolean {
  if (isLink(a)) {
    return isLink(b) ? (a.text === b.text && a.url === b.url) : false
  } else if (loose && isEmpty(a) && isEmpty(b)) {
    return true
  } else {
    return a === b
  }
}
