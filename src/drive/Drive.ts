import { drive_v3, google } from 'googleapis'
import { Auth } from '../Auth'
import { File } from './File'
import { Folder } from './Folder'

export class Drive {

  static async load(auth: Auth): Promise<Drive> {
    const oauth = await auth.authorize()
    const api = google.drive({ version: 'v3', auth: oauth })
    return new Drive(auth, api)
  }

  constructor(
    readonly auth: Auth,
    private readonly api: drive_v3.Drive
  ) {}

  folder(id: string): Folder {
    return new Folder(this.auth, this.api, this, id)
  }

  async file(id: string): Promise<File | undefined> {
    try {
      const file = await this.api.files.get({ fileId: id, fields: 'id, name, mimeType, parents, createdTime, modifiedTime' })
      return new File(this.auth, file.data)
    } catch (e: any) {
      if (e.code) {
        console.warn(`Document not shared... https://docs.google.com/document/d/${id}/edit`)
      } else {
        throw e
      }
    }
  }

  async copy(id: string, name: string, folder: string): Promise<string> {
    const resp = await this.api.files.copy({
      fileId: id,
      requestBody: { name, parents: [ folder ] },
      fields: 'id'
    })

    const file = resp.data
    return file.id as string
  }

  async getComments(fileId: string): Promise<drive_v3.Schema$Comment[]> {
    const resp = await this.api.comments.list({ fileId, fields: '*' })
    return resp.data.comments || []
  }

  async updateComment(fileId: string, commentId: string, comment: string): Promise<void> {
    await this.api.comments.update({
      fileId, commentId,
      requestBody: { content: comment },
      fields: 'id'
    })
  }
}
