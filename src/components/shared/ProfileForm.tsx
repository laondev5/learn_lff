"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, User, Camera, ShieldCheck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  kycIdType: z.string().optional(),
  kycIdNumber: z.string().optional(),
  kycDateOfBirth: z.string().optional(),
  kycAddress: z.string().optional(),
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
    kycStatus?: string
    kycIdType?: string
    kycIdNumber?: string
    kycDateOfBirth?: string
    kycAddress?: string
    kycLivePhotoUrl?: string
  }
}

export function ProfileForm({ current }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [livePhotoUrl, setLivePhotoUrl] = useState(current.kycLivePhotoUrl || "")
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

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
      kycIdType: current.kycIdType ?? "",
      kycIdNumber: current.kycIdNumber ?? "",
      kycDateOfBirth: current.kycDateOfBirth ?? "",
      kycAddress: current.kycAddress ?? "",
    },
  })

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function startCamera() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported on this device or browser.")
      return
    }

    setCameraError("")
    setUploading(true)

    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })

      streamRef.current = stream
      setCameraOpen(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError("Unable to access your camera. Please allow camera permission and try again.")
    } finally {
      setUploading(false)
    }
  }

  async function uploadCapturedPhoto(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "kyc")

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (data.url) {
        setLivePhotoUrl(data.url)
        setCameraOpen(false)
        stopCamera()
        toast.success("Photo captured successfully")
        return
      }

      toast.error("Photo upload failed")
    } catch {
      toast.error("Error uploading captured photo")
    } finally {
      setUploading(false)
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera is not ready yet. Please try again.")
      return
    }

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext("2d")
    if (!context) {
      toast.error("Unable to capture photo from the camera.")
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92)
    })

    if (!blob) {
      toast.error("Unable to create image file from the camera capture.")
      return
    }

    const file = new File([blob], `kyc-live-photo-${Date.now()}.jpg`, { type: "image/jpeg" })
    await uploadCapturedPhoto(file)
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    const fd = new FormData()
    fd.set("country", data.country)
    fd.set("state", data.state)
    fd.set("city", data.city)
    fd.set("ordination", data.ordination)
    if (data.kycIdType) fd.set("kycIdType", data.kycIdType)
    if (data.kycIdNumber) fd.set("kycIdNumber", data.kycIdNumber)
    if (data.kycDateOfBirth) fd.set("kycDateOfBirth", data.kycDateOfBirth)
    if (data.kycAddress) fd.set("kycAddress", data.kycAddress)
    if (livePhotoUrl) fd.set("kycLivePhotoUrl", livePhotoUrl)

    const result = await updateProfile(fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Profile updated successfully!")
    }
    setLoading(false)
  }

  const kycStatusColors = {
    not_started: "bg-muted text-muted-foreground",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account and identity verification.</p>
        </div>
        {current.role === "student" && (
          <Badge className={kycStatusColors[current.kycStatus as keyof typeof kycStatusColors] || kycStatusColors.not_started}>
            KYC: {current.kycStatus?.replace("_", " ") || "Not Started"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Read-only info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Account Details
              </CardTitle>
              <CardDescription>Official information — contact admin to change.</CardDescription>
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
              <CardDescription>Location and ordination details.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <SelectValue placeholder="Select ordination" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDINATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.ordination && <p className="text-xs text-destructive">{errors.ordination.message}</p>}
                  </div>
                </div>

                {current.role === "student" && (
                  <>
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        KYC Verification
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ID Type</Label>
                        <Select
                          defaultValue={current.kycIdType || undefined}
                          onValueChange={(v) => setValue("kycIdType", v ?? undefined)}
                          disabled={loading || current.kycStatus === "verified"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ID Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nin">NIN</SelectItem>
                            <SelectItem value="passport">International Passport</SelectItem>
                            <SelectItem value="driver_license">Driver&apos;s License</SelectItem>
                            <SelectItem value="voter_card">Voter&apos;s Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kycIdNumber">ID Number</Label>
                        <Input
                          id="kycIdNumber"
                          disabled={loading || current.kycStatus === "verified"}
                          {...register("kycIdNumber")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kycDateOfBirth">Date of Birth</Label>
                      <Input
                        id="kycDateOfBirth"
                        type="date"
                        disabled={loading || current.kycStatus === "verified"}
                        {...register("kycDateOfBirth")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kycAddress">Residential Address</Label>
                      <Textarea
                        id="kycAddress"
                        rows={2}
                        disabled={loading || current.kycStatus === "verified"}
                        {...register("kycAddress")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Live Photo</Label>
                      <div className="flex flex-col gap-4">
                        {livePhotoUrl ? (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
                            <Image
                              src={livePhotoUrl}
                              alt="KYC live photo"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            {current.kycStatus !== "verified" && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute bottom-2 right-2"
                                onClick={() => {
                                  setLivePhotoUrl("")
                                  setCameraError("")
                                  void startCamera()
                                }}
                              >
                                Retake
                              </Button>
                            )}
                          </div>
                        ) : cameraOpen ? (
                          <div className="space-y-3">
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-black">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                onClick={() => void capturePhoto()}
                                disabled={uploading}
                              >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Take Picture"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={uploading}
                                onClick={() => {
                                  setCameraOpen(false)
                                  stopCamera()
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Position your face clearly in the frame, then take the picture.
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-2 bg-muted/30">
                            <Camera className="h-8 w-8 text-muted-foreground" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Take a live photo of yourself with your device camera</p>
                              <p className="text-xs text-muted-foreground">Allow camera access, then capture a clear photo</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploading}
                              onClick={() => void startCamera()}
                            >
                              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open Camera"}
                            </Button>
                            {cameraError && (
                              <p className="text-xs text-destructive">{cameraError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" disabled={loading || uploading} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Church Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Local Church</Label>
                <p className="text-sm font-medium">{current.church || "Not assigned"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">District</Label>
                <p className="text-sm font-medium">{current.district || "Not assigned"}</p>
              </div>
            </CardContent>
          </Card>

          {current.role === "student" && current.kycStatus !== "verified" && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-semibold">Action Required</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Please complete your KYC verification to access all features of the LMS.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
