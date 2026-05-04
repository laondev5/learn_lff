export function getAuthSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
}
