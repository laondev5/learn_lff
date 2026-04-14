"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createUser } from "@/actions/user.actions"

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["teacher", "student"]),
  cohort: z.string().optional(),
  church: z.string().optional(),
  district: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface CreateUserDialogProps {
  children: React.ReactNode
}

export function CreateUserDialog({ children }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const role = watch("role")

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    const formData = new FormData()
    formData.set("name", data.name)
    formData.set("email", data.email)
    formData.set("role", data.role)
    if (data.cohort) formData.set("cohort", data.cohort)
    if (data.church) formData.set("church", data.church)
    if (data.district) formData.set("district", data.district)

    const result = await createUser(formData)

    if (result.error) {
      toast.error(result.error)
    } else if (result.emailFailed) {
      toast.success("User created, but the welcome email could not be sent.")
      setOpen(false)
      reset()
    } else {
      toast.success("User created and credentials email sent.")
      setOpen(false)
      reset()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, { onClick: () => setOpen(true) })}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a teacher or student account. Login credentials will be emailed to them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="John Doe" disabled={isLoading} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="john@example.com" disabled={isLoading} {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select onValueChange={(v) => setValue("role", v as "teacher" | "student")} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="cohort">Cohort (e.g. April 2026)</Label>
              <Input
                id="cohort"
                placeholder="April 2026"
                disabled={isLoading}
                {...register("cohort")}
              />
            </div>
          )}

          {(role === "teacher" || role === "student") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="church">Church</Label>
                <Input
                  id="church"
                  placeholder="e.g. Living Faith Church"
                  disabled={isLoading}
                  {...register("church")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  placeholder="e.g. Lagos District"
                  disabled={isLoading}
                  {...register("district")}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
