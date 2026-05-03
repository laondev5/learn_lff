import "server-only"
import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"

export type CredentialValidationResult =
  | {
      status: "ok"
      user: InstanceType<typeof User>
    }
  | {
      status: "invalid"
    }
  | {
      status: "temporary_password_expired"
      user: InstanceType<typeof User>
    }

export async function validateUserCredentials(
  email: string,
  password: string
): Promise<CredentialValidationResult> {
  await connectDB()

  const user = await User.findOne({
    email: email.toLowerCase(),
    isActive: true,
  })

  if (!user) {
    return { status: "invalid" }
  }

  const isValid = await bcryptjs.compare(password, user.hashedPassword)
  if (!isValid) {
    return { status: "invalid" }
  }

  if (
    user.mustChangePassword &&
    user.temporaryPasswordExpiresAt &&
    user.temporaryPasswordExpiresAt.getTime() < Date.now()
  ) {
    return { status: "temporary_password_expired", user }
  }

  return { status: "ok", user }
}
