import { drive_v3 } from 'googleapis'
import { Auth } from '../Auth'
import { Spreadsheet } from '../sheets/Spreadsheet'

export class File {

  constructor(
    private readonly auth: Auth,
    private readonly file: drive_v3.Schema$File
  ) {}

  get id(): string {
    if (!this.file.id) { throw new Error(`No id associated with file`) }
    return this.file.id
  }

  get name(): string | undefined | null {
    return this.file.name
  }

  get modifiedTime(): number {
    if (!this.file.modifiedTime) {
      console.warn(`Couldn't determine last modified time for ${this.file.id}\n`, this.file)
      return Date.now()
    }

    return Date.parse(this.file.modifiedTime)
  }

  updatedSince(lastRead: number | undefined): boolean {
    if (!lastRead) {
      return true
    }

    return this.modifiedTime > lastRead
  }

  async spreadsheet(): Promise<Spreadsheet> {
    if (!this.file.id) {
      throw new Error(`Can't access a sheet without a valid id`)
    }

    return await Spreadsheet.load(this.auth, this.file.id)
  }
}
