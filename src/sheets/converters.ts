import { sheets_v4 } from 'googleapis';
import { CellValue, trimGrid } from '../grid/CellValue';

export function cellValueOf(cell?: sheets_v4.Schema$CellData): CellValue {
  const v = cell?.effectiveValue;
  if (!v) { return undefined; }

  const value: CellValue = [v.stringValue, v.numberValue, v.formulaValue, v.boolValue]
    .reduce<CellValue>((a, b) => (b !== null && typeof b !== 'undefined') ? b : a, undefined);

  const url = cell.hyperlink || cell.userEnteredFormat?.textFormat?.link?.uri;

  return url ? { url, text: `${value}` } : value;
}

export function cellsOf(rows: sheets_v4.Schema$RowData[]): CellValue[][] {
  const grid: CellValue[][] = rows.map(r => r.values?.map(cellValueOf) || [])
  return trimGrid(grid)
}

const DefaultFormat: sheets_v4.Schema$CellFormat = {
  textFormat: { fontFamily: 'Roboto Condensed' },
  verticalAlignment: 'MIDDLE'
}

export function toCellData(value: CellValue, format?: sheets_v4.Schema$CellFormat): sheets_v4.Schema$CellData {
  switch (typeof value) {
    case 'string':
      return { userEnteredValue: { stringValue: value }, userEnteredFormat: { ...DefaultFormat, ...format } }

    case 'boolean':
      return { userEnteredValue: { boolValue: value }, userEnteredFormat: { ...DefaultFormat, ...format } }

    case 'number':
      return { userEnteredValue: { numberValue: value }, userEnteredFormat: { ...DefaultFormat, ...format } }

    case 'object':
      return {
        userEnteredFormat: {
          textFormat: { fontFamily: 'Roboto Condensed', link: { uri: value.url } },
          verticalAlignment: 'MIDDLE'
        },
        userEnteredValue: { stringValue: value.text }
      }

    default:
      return {}
  }
}
