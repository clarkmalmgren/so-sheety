import { Auth } from '../../Auth'
import { Drive } from '../../drive/Drive'
import path from 'path'
import os from 'os'

export type Setup = {
  auth: Auth
  drive: Drive
}

/**
 * Creates a test environment with authentication and test folder
 */
export async function getSetup(): Promise<Setup> {
  const tokenPath = path.join(os.homedir(), '.so-sheety', 'token.json')
  const credPath = path.join(os.homedir(), '.so-sheety', 'credentials.json')
  
  // Authenticate
  const auth = new Auth(tokenPath, credPath)
  const drive = await Drive.load(auth)
  
  return { auth, drive }
}
