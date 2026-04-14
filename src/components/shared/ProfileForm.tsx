"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateProfile } from "@/actions/user.actions"
import { ORDINATION_OPTIONS } from "@/lib/constants"

const schema = z.object({
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  ordination: z.string().min(1, "Please select an ordination"),
})

type FormData = z.infer<typeof schema>

interface ProfileFormProps {
  current: {
    country?: string
    state?: string
    city?: string
    ordination?: string
    name: string
    email: string
    church?: string
    district?: string
    cohort?: string
    role: string
  }
}

export function ProfileForm({ current }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: current.country ?? "",
      state: current.state ?? "",
      city: current.city ?? "",
      ordination: current.ordination ?? undefined,
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const fd = new FormData()
    fd.set("country", data.country)
    fd.set("state", data.state)
    fd.set("city", data.city)
    fd.set("ordination", data.ordination)
    const result = await updateProfile(fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Profile updated successfully!")
    }
    setLoading(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete your profile information.</p>
      </div>

      {/* Read-only info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Account Details
          </CardTitle>
          <CardDescription>Set by the administrator — contact admin to update.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <p className="text-sm font-medium">{current.name}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{current.email}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="text-sm font-medium capitalize">{current.role}</p>
          </div>
          {current.church && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Church</Label>
              <p className="text-sm font-medium">{current.church}</p>
            </div>
          )}
          {current.district && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">District</Label>
              <p className="text-sm font-medium">{current.district}</p>
            </div>
          )}
          {current.cohort && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cohort</Label>
              <p className="text-sm font-medium">{current.cohort}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable profile fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>Fill in your location and ordination details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" placeholder="Nigeria" disabled={loading} {...register("country")} />
                {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="Lagos" disabled={loading} {...register("state")} />
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Ikeja" disabled={loading} {...register("city")} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Ordination</Label>
              <Select
                defaultValue={current.ordination || undefined}
                onValueChange={(v) => setValue("ordination", v ?? "", { shouldValidate: true })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your ordination" />
                </SelectTrigger>
                <SelectContent>
                  {ORDINATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ordination && <p className="text-xs text-destructive">{errors.ordination.message}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
