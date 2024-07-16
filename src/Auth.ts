import { authenticate } from '@google-cloud/local-auth'
import { existsSync, promises as fs } from 'fs'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import path from 'path'

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets'
]

export class Auth {

  private client: OAuth2Client | undefined

  constructor(
    private readonly tokenPath: string,
    private readonly credentialsPath: string
  ) {}

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  private async loadSavedCredentialsIfExist(): Promise<OAuth2Client | undefined> {
    try {
      const content = await fs.readFile(this.tokenPath)
      const credentials = JSON.parse(content.toString())
      return google.auth.fromJSON(credentials) as OAuth2Client
    } catch (err) {
      return undefined
    }
  }

  /**
   * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  private async saveCredentials(client: OAuth2Client): Promise<void> {
    const content = await fs.readFile(this.credentialsPath)
    const keys = JSON.parse(content.toString())
    const key = keys.installed || keys.web
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    })
    
    const folder = path.basename(this.tokenPath)
    if (!existsSync(folder)) {
      await fs.mkdir(folder, { recursive: true })
    }
    await fs.writeFile(this.tokenPath, payload)
  }

  /**
   * Load or request or authorization to call APIs.
   */
  async authorize(): Promise<OAuth2Client> {
    // First just check if it is loaded
    if (this.client) { return this.client }

    // Load from disk
    this.client = await this.loadSavedCredentialsIfExist()
    if (this.client) { return this.client }

    // Ok, finally actually authenticate from scratch
    this.client = await authenticate({
      scopes: SCOPES,
      keyfilePath: this.credentialsPath,
    })

    // Save it off if valid
    if (this.client.credentials) {
      await this.saveCredentials(this.client)
    }

    return this.client
  }

}
