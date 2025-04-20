import { Document } from '../../docs/Document'
import { isParagraph } from '../../docs/refs'
import { ParagraphRef } from '../../docs/refs/ParagraphRef'
import { LazyTableRef } from '../../docs/refs/TableRef'
import { getSetup, Setup } from '../helpers/setup'

const TEMPLATE_DOCUMENT_ID = '1ExczA838QVvpfwMTqtCHckq8KzsNpaZ4ZEIIKDYxnHA' 
const TEMPLATE_FOLDER_ID = '1Ai-sDnAAVOgRF5oPCVBK4T05xXhe3loW'

describe('Document', () => {
  let setup: Setup
  let doc: Document

  beforeAll(async () => {
    setup = await getSetup()
  })

  beforeEach(async () => {
    const target = await setup.drive.copy(TEMPLATE_DOCUMENT_ID, `test-${Date.now()}`, TEMPLATE_FOLDER_ID)
    doc = await Document.load(target, setup.auth)
  })

  afterEach(async () => {
    await setup.drive.delete(doc.id)
  })

  const getRefreshedDoc: () => Promise<Document> =
    async () => { return await Document.load(doc.id, setup.auth) }

  function mutateTail(): void {
    const tail = doc.tail as ParagraphRef
    tail.replace('{{anchor_3}}', 'Verify')
  }

  function verifyTail(refreshed: Document): void {
    const tail = refreshed.tail as ParagraphRef
    expect(tail.text).toEqual('__Verify__')
  }

  describe('tables', () => {
    it('should be able to find a table after a given index', async () => {
      const table = doc.firstTableAfter('Mutate After')?.load(1)
      expect(table).toBeDefined()
    })

    it('should create a mutate a table', async () => {
      const table = doc.firstTableAfter('Mutate After')?.load(1)
      if (!table) { throw new Error('Table not found') }

      table.row(0).setObj({ A: 1, B: 2, C: 3, D: 4 })
      table.row(1).setObj({ A: 5, B: 6, C: 7, D: 8 })

      mutateTail()  
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.firstTableAfter('Mutate After')?.load(1)
      if (!ref) { throw new Error('Table not found') }

      expect(ref.lookup('A', 1)?.obj()).toEqual({ A: 1, B: 2, C: 3, D: 4 })
      expect(ref.row(1).obj()).toEqual({ A: 5, B: 6, C: 7, D: 8 })
      verifyTail(refreshed)
    })

    it('should be able to style a table', async () => {
      const table = doc.firstTableAfter('Mutate After')?.load(1)
      if (!table) { throw new Error('Table not found') }

      table.styleRow({ textColor: '#ffffff', backgroundColor: '#046492', bold: true, fontSize: 10, padding: 0.03 }, -1)
      table.styleRow({ fontSize: 8, padding: 0.03, verticalAlignment: 'MIDDLE' }, 0)

      table.style({ horizontalAlignment: 'CENTER' }, -1, 1, 1)
      table.style({ horizontalAlignment: 'CENTER' }, 0, 1, 1)

      table.row(0).setObj({ A: 1, B: 2, C: 3, D: 4 })
      table.row(1).setObj({ A: 5, B: 6, C: 7, D: 8 })

      mutateTail()  
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.firstTableAfter('Mutate After')?.load(1)
      if (!ref) { throw new Error('Table not found') }

      expect(ref.row(0).obj()).toEqual({ A: 1, B: 2, C: 3, D: 4 })
      expect(ref.row(1).obj()).toEqual({ A: 5, B: 6, C: 7, D: 8 })
      verifyTail(refreshed)
    })
  })

  describe('paragraphs', () => {
    it('should be able to update a portion of a paragraph', async () => {
      const p = doc.find(r => isParagraph(r) && r.text.startsWith('Testing Title')) as ParagraphRef | undefined
      if (!p) { throw new Error('Paragraph not found') }

      const replaced = p.replace('{{anchor_1}}', '- WORKS!')
      expect(replaced).toBe(true)
      expect(p.text).toEqual('Testing Title - WORKS!')

      mutateTail()
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.find(r => isParagraph(r) && r.text.startsWith('Testing Title')) as ParagraphRef | undefined
      if (!ref) { throw new Error('Paragraph not found') }

      expect(ref.text).toEqual('Testing Title - WORKS!')
      verifyTail(refreshed)
    })

    it('should be able to update a portion of a paragraph using a regex', async () => {
      const p = doc.find(r => isParagraph(r) && r.text.startsWith('Testing Title')) as ParagraphRef | undefined
      if (!p) { throw new Error('Paragraph not found') }

      p.replace(/{{anchor_\d}}/, '- WORKS!')
      mutateTail()
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.find(r => isParagraph(r) && r.text.startsWith('Testing Title')) as ParagraphRef | undefined
      if (!ref) { throw new Error('Paragraph not found') }

      expect(ref.text).toEqual('Testing Title - WORKS!')
      verifyTail(refreshed)
    })

    it('should be able to replace an entire paragraph', async () => {
      const p = doc.find(r => isParagraph(r) && r.text === '{{anchor_2}}') as ParagraphRef | undefined
      if (!p) { throw new Error('Paragraph not found') }

      p.replaceAll('This works too!')
      mutateTail()
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.find(r => isParagraph(r) && r.text === 'This works too!') as ParagraphRef | undefined
      expect(ref).toBeDefined()
      verifyTail(refreshed)
    })
  })

  describe('insertion', () => {
    it('should be able to insert a table', async () => {
      let ref = doc.find(r => isParagraph(r) && r.isHeading && r.text === 'Insert After')
      if (!ref) { throw new Error('Heading not found') }

      const p = ref.next
      expect(p.type).toEqual('paragraph')

      const tableRef = p.insertBefore(new LazyTableRef(['E', 'F', 'G', 'H'], doc))
      expect(tableRef.type).toEqual('table')

      const table = tableRef.load(1)
      table.row(0).setObj({ E: 1, F: 2, G: 3, H: 4 })
      mutateTail()
      await doc.commit()
      
      const refreshed = await getRefreshedDoc()
      const t2 = refreshed.firstTableAfter('Insert After')?.load(1)
      if (!t2) { throw new Error('Table not found') }

      expect(t2.lookup('E', 1)?.obj()).toEqual({ E: 1, F: 2, G: 3, H: 4 })
      verifyTail(refreshed)
    })
  })

  describe('lists', () => {
    it('should be able to add to a list', async () => {
      const p = doc.find(r => isParagraph(r) && r.text === 'Three') as ParagraphRef | undefined
      if (!p) { throw new Error('List item not found') }

      const next = p.insertParagraph('Example Heading [link] - tktk')
      next.styleText({ bold: true }, 0, 15)
      next.styleText({ link: 'https://www.google.com' }, 17, 21)

      mutateTail()
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.find(r => isParagraph(r) && r.text === 'Three') as ParagraphRef | undefined
      if (!ref) { throw new Error('Heading not found') }

      expect((ref.next as ParagraphRef).text).toMatch(/^Example Heading/)
      verifyTail(refreshed)
    })

    it('should be able to add to a list by appending parts of the text', async () => {
      const p = doc.find(r => isParagraph(r) && r.text === 'Three') as ParagraphRef | undefined
      if (!p) { throw new Error('List item not found') }

      p.insertParagraph(
        { text: 'Example Heading', style: { bold: true } },
        ' [',
        { text: 'link', style: { link: 'https://www.google.com' } },
        '] - tktk'
      )

      mutateTail()
      await doc.commit()

      const refreshed = await getRefreshedDoc()
      const ref = refreshed.find(r => isParagraph(r) && r.text === 'Three') as ParagraphRef | undefined
      if (!ref) { throw new Error('Heading not found') }

      expect((ref.next as ParagraphRef).text).toMatch(/^Example Heading/)
      verifyTail(refreshed)
    })
  })
})
