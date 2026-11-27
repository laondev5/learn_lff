"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      })

      if (!res.ok) throw new Error()

      setSent(true)
      toast.success("Password reset instructions sent to your email")
    } catch {
      toast.error("Something went wrong. Please contact your administrator.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {sent ? "Check your inbox" : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {sent
            ? "If an account matches that email address, reset instructions are on their way."
            : "Enter the email address on your account and we’ll send you a secure reset link."}
        </p>
      </div>

      {sent ? (
        <div className="space-y-6">
          <div role="status" className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">Reset instructions sent</p>
              <p className="mt-1 text-muted-foreground">
                The link expires after a short time and can only be used once. Check your spam folder if it does not arrive.
              </p>
            </div>
          </div>
          <Button asChild className="h-13 w-full rounded-xl text-base font-semibold shadow-sm">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="block w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Use a different email address
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                  className="h-13 rounded-xl pl-11 text-base md:text-base"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-13 w-full rounded-xl text-base font-semibold shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>

          <Link
            href="/auth/login"
            className="mt-8 flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </>
      )}
    </AuthLayout>
  )
}
