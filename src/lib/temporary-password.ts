import "server-only"
import { randomInt } from "crypto"

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz"
const NUMBERS = "23456789"
const SPECIALS = "@#$!%*?&"
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SPECIALS}`

function pick(source: string) {
  return source[randomInt(0, source.length)]
}

function shuffle(values: string[]) {
  const output = [...values]

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1)
    ;[output[index], output[swapIndex]] = [output[swapIndex], output[index]]
  }

  return output
}

export const TEMPORARY_PASSWORD_TTL_HOURS =
  Number(process.env.TEMPORARY_PASSWORD_TTL_HOURS) || 72

export function getTemporaryPasswordExpiryDate() {
  return new Date(Date.now() + TEMPORARY_PASSWORD_TTL_HOURS * 60 * 60 * 1000)
}

export function generateSecureTemporaryPassword(length = 12) {
  const passwordCharacters = [
    pick(UPPERCASE),
    pick(LOWERCASE),
    pick(NUMBERS),
    pick(SPECIALS),
  ]

  while (passwordCharacters.length < Math.max(length, 8)) {
    passwordCharacters.push(pick(ALL_CHARACTERS))
  }

  return shuffle(passwordCharacters).join("")
}
