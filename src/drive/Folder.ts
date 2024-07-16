import { drive_v3 } from 'googleapis'
import { Auth } from '../Auth'
import { Drive } from './Drive'
import { File } from './File'

export class Folder {

  constructor(
    private readonly auth: Auth,
    private readonly api: drive_v3.Drive,
    private readonly drive: Drive,
    private readonly id: string
  ) {}
  
  private async followLinks(file: drive_v3.Schema$File): Promise<drive_v3.Schema$File> {
    if (file.mimeType === 'application/vnd.google-apps.shortcut' && file.shortcutDetails?.targetId) {
      const linked = await this.api.files.get({ fileId: file.shortcutDetails.targetId, fields: 'id, name, mimeType, parents, createdTime, modifiedTime, shortcutDetails' })
      return (linked && linked.data) ? await this.followLinks(linked.data) : file
    } else {
      return file
    }
  }

  private async recurse(folder: string, fn: (file: drive_v3.Schema$File) => Promise<void>): Promise<void> {
    const list = await this.api.files.list({ q: `'${folder}' in parents and trashed = false`, fields: 'nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, shortcutDetails)' })
    const children: drive_v3.Schema$File[] = []
    
    for (let maybeLinkedFile of list.data.files || []) {
      let unnested: drive_v3.Schema$File | undefined = undefined
      
      try {
        unnested = await this.followLinks(maybeLinkedFile)
      } catch (e) {
        console.warn(`Can't follow link for ${maybeLinkedFile.name}[${maybeLinkedFile.id}] owned by ${maybeLinkedFile.owners?.[0].displayName}`)
      }

      if (!unnested) {
        // do nothing
      } else if (unnested.mimeType === 'application/vnd.google-apps.folder') {
        children.push(unnested)
      } else {
        await fn(unnested)
      }
    }
    
    children && await Promise.all(children.map(c => this.recurse(c.id || '', fn)))
  }

  async getFilesByMime(mime: string): Promise<File[]> {
    const list: File[] = []
    await this.recurse(this.id, async (f) => {
      if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetMimeType === mime && f.shortcutDetails.targetId) {
        const linked = await this.drive.file(f.shortcutDetails.targetId)
        linked && list.push(linked)
      } else if (f.mimeType === mime) {
        list.push(new File(this.auth, f))
      }
    })
    return list
  }

  async getDocs(): Promise<File[]> {
    return this.getFilesByMime('application/vnd.google-apps.document')
  }

  async getSheets(): Promise<File[]> {
    return this.getFilesByMime('application/vnd.google-apps.spreadsheet')
  }

}
