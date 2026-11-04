/** Public account navigation only: a chat greeting never authenticates a browser. */
export function accountMessage(text: string): string | null {
  const command = text.trim().toUpperCase().replace(/[!.?]+$/, '').replace(/\s+/g, ' ')
  const account = 'https://www.sor7ed.com/account'
  if (['SIGN OUT', 'SIGNOUT', 'LOG OUT', 'LOGOUT'].includes(command)) {
    return `To sign out, open your SOR7ED account and choose Sign out.\n${account}`
  }
  if (/^(?:HI|HELLO|HEY)(?: (?:SOR7ED|SORTED))?$/.test(command)
    || ['ACCOUNT', 'MY ACCOUNT', 'MENU', 'HELP', 'SIGN IN', 'SIGNIN', 'SIGN UP', 'SIGNUP', 'LOG IN', 'LOGIN'].includes(command)) {
    return `Welcome to SOR7ED.\n\nSign in or create your account:\n${account}\n\nManage your saved links, profile and sign out there.\n\nReply STOP to pause messages.`
  }
  return null
}
