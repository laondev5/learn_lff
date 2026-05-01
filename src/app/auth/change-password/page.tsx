"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { changePassword } from "@/actions/auth.actions"

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const result = await changePassword(data.currentPassword, data.newPassword)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success("Password changed! Redirecting…")

    // Re-sign in with the new password to get a fresh JWT with mustChangePassword: false
    const dashboardMap: Record<string, string> = {
      admin: "/admin/dashboard",
      teacher: "/teacher/dashboard",
      student: "/student/dashboard",
    }
    const destination = dashboardMap[result.role ?? ""] ?? "/"

    const signInResult = await signIn("credentials", {
      email: result.email,
      password: data.newPassword,
      redirect: false,
      callbackUrl: destination,
    })

    if (signInResult?.error) {
      toast.error("Password changed, but automatic sign-in failed. Please sign in again.")
      router.replace("/auth/login")
      router.refresh()
      return
    }

    router.replace(destination)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="LFF LMS" width={60} height={60} className="object-contain" style={{ width: 60, height: "auto" }} unoptimized />
          </div>
          <CardTitle className="text-xl">Set New Password</CardTitle>
          <CardDescription>
            You must change your temporary password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current (Temporary) Password</Label>
              <Input
                id="currentPassword"
                type="password"
                disabled={loading}
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                disabled={loading}
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                disabled={loading}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
