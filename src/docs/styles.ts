import { docs_v1 } from 'googleapis'

export type TextStyle = {
  textColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: number
  fontFamily?: string
  link?: string
}

export type ParagraphStyle = {
  horizontalAlignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFY'
}

export type TableCellStyle = {
  backgroundColor?: string
  padding?: number
  verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM'
}

export function toGoogleParagraphStyle(style: ParagraphStyle): docs_v1.Schema$ParagraphStyle {
  const ps: docs_v1.Schema$ParagraphStyle = {}

  if (style.horizontalAlignment) { ps.alignment = style.horizontalAlignment }

  return ps
}

export function toGoogleTextStyle(style: TextStyle): docs_v1.Schema$TextStyle {
  const ps: docs_v1.Schema$TextStyle = {}

  if (style.textColor) { ps.foregroundColor = hexToColor(style.textColor) }
  if (typeof style.bold === 'boolean') { ps.bold = style.bold }
  if (typeof style.italic === 'boolean') { ps.italic = style.italic }
  if (typeof style.underline === 'boolean') { ps.underline = style.underline }
  if (typeof style.strikethrough === 'boolean') { ps.strikethrough = style.strikethrough }
  if (style.fontSize) { ps.fontSize = { unit: 'PT', magnitude: style.fontSize } }
  if (style.fontFamily) { ps.weightedFontFamily = { fontFamily: style.fontFamily } }
  if (style.link) { ps.link = { url: style.link } }
  
  return ps
}

export function toGoogleTableCellStyle(style: TableCellStyle): docs_v1.Schema$TableCellStyle {
  const ts: docs_v1.Schema$TableCellStyle = {}

  if (style.backgroundColor) {
    ts.backgroundColor = hexToColor(style.backgroundColor)
  }

  if (style.padding) {
    const pad = { unit: 'PT', magnitude: style.padding * 72 }
    ts.paddingTop =    pad
    ts.paddingBottom = pad
    ts.paddingLeft =   pad
    ts.paddingRight =  pad
  }

  if (style.verticalAlignment) {
    ts.contentAlignment = style.verticalAlignment
  }

  return ts
}

function hexToColor(hex: string): docs_v1.Schema$OptionalColor {
  hex = hex.replace("#", "");

  // Handle 3-digit hex codes
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  return {
    color: {
      rgbColor: {
        red: parseInt(hex.slice(0, 2), 16) / 255,
        green: parseInt(hex.slice(2, 4), 16) / 255,
        blue: parseInt(hex.slice(4, 6), 16) / 255
      }
    }
  }
}

type Converted<T> =
    T extends TableCellStyle ? docs_v1.Schema$TableCellStyle : {}
  & T extends ParagraphStyle ? docs_v1.Schema$ParagraphStyle : {}
  & T extends TextStyle ? docs_v1.Schema$TextStyle : {}

export function toGoogleStyle<T extends TableCellStyle | ParagraphStyle | TextStyle>(style: T): Converted<T> {
  return [ toGoogleParagraphStyle, toGoogleTableCellStyle, toGoogleTextStyle ]
    .reduce((acc, fn) => {
      const result = fn(style)
      return { ...acc, ...result }
    }, {} as Converted<T>)
}

type StyleName = 'paragraph' | 'tableCell' | 'text'

type GoogleStyle<T extends StyleName> =
  T extends 'paragraph' ? docs_v1.Schema$ParagraphStyle :
  T extends 'tableCell' ? docs_v1.Schema$TableCellStyle :
  T extends 'text' ? docs_v1.Schema$TextStyle :
  never

type InputStyle<T extends StyleName> =
  T extends 'paragraph' ? ParagraphStyle :
  T extends 'tableCell' ? TableCellStyle :
  T extends 'text' ? TextStyle :
  never


export function extractGoogleStyle<T extends StyleName>(style: InputStyle<T>, name: T): GoogleStyle<T> {
  switch (name) {
    case 'paragraph': return toGoogleParagraphStyle(style as ParagraphStyle) as GoogleStyle<T>
    case 'tableCell': return toGoogleTableCellStyle(style as TableCellStyle) as GoogleStyle<T>
    case 'text': return toGoogleTextStyle(style as TextStyle) as GoogleStyle<T>
    default: throw new Error(`Unknown style name: ${name}`)
  }
}

export type BulletStyle =
  | 'ARROW'      // An arrow, corresponding to a Unicode U+2794 code point
  | 'ARROW3D'    // An arrow with 3D shading, corresponding to a Unicode U+27a2 code point
  | 'CHECKBOX'   // A hollow square, corresponding to a Unicode U+274f code point
  | 'CIRCLE'     // A hollow circle, corresponding to a Unicode U+25cb code point
  | 'DIAMOND'    // A solid diamond, corresponding to a Unicode U+25c6 code point
  | 'DIAMONDX'   // A diamond with an 'x', corresponding to a Unicode U+2756 code point
  | 'HOLLOWDIAMOND' // A hollow diamond, corresponding to a Unicode U+25c7 code point
  | 'DISC'       // A solid circle, corresponding to a Unicode U+25cf code point
  | 'SQUARE'     // A solid square, corresponding to a Unicode U+25a0 code point
  | 'STAR'       // A star, corresponding to a Unicode U+2605 code point
  | 'ALPHA'      // A lowercase letter, like 'a', 'b', or 'c'
  | 'UPPERALPHA' // An uppercase letter, like 'A', 'B', or 'C'
  | 'DECIMAL'    // A number, like '1', '2', or '3'
  | 'ZERODECIMAL' // A number where single digit numbers are prefixed with a zero, like '01', '02', or '03'
  | 'ROMAN'      // A lowercase roman numeral, like 'i', 'ii', or 'iii'
  | 'UPPERROMAN' // An uppercase roman numeral, like 'I', 'II', or 'III'
  | 'LEFTTRIANGLE' // A triangle pointing left, corresponding to a Unicode U+25c4 code point




