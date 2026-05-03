export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."

export function hasUppercase(value: string) {
  return /[A-Z]/.test(value)
}

export function hasLowercase(value: string) {
  return /[a-z]/.test(value)
}

export function hasNumber(value: string) {
  return /\d/.test(value)
}

export function hasSpecialCharacter(value: string) {
  return /[^A-Za-z0-9]/.test(value)
}

export function isStrongPassword(value: string) {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    hasUppercase(value) &&
    hasLowercase(value) &&
    hasNumber(value) &&
    hasSpecialCharacter(value)
  )
}
