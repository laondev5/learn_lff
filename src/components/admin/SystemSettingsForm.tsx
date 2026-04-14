"use client"

import { useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateOrgName, uploadSystemImage } from "@/actions/system.actions"

interface SystemSettingsFormProps {
  organizationName: string
  logoUrl: string | null
  signatureUrl: string | null
}

export function SystemSettingsForm({ organizationName, logoUrl, signatureUrl }: SystemSettingsFormProps) {
  const [orgName, setOrgName] = useState(organizationName)
  const [savingName, setSavingName] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl)
  const [currentSignatureUrl, setCurrentSignatureUrl] = useState(signatureUrl)

  async function handleOrgNameSave(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    const fd = new FormData()
    fd.set("organizationName", orgName)
    const result = await updateOrgName(fd)
    if (result.error) toast.error(result.error)
    else toast.success("Organization name updated")
    setSavingName(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "signature") {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === "logo") setUploadingLogo(true)
    else setUploadingSignature(true)

    const fd = new FormData()
    fd.set("file", file)

    const result = await uploadSystemImage(fd, type)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${type === "logo" ? "Logo" : "Signature"} uploaded`)
      if (type === "logo") setCurrentLogoUrl(result.url ?? null)
      else setCurrentSignatureUrl(result.url ?? null)
    }

    if (type === "logo") setUploadingLogo(false)
    else setUploadingSignature(false)
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Organization Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization Name</CardTitle>
          <CardDescription>Appears on certificates and throughout the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOrgNameSave} className="flex gap-3">
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization name"
              className="max-w-sm"
              disabled={savingName}
            />
            <Button type="submit" disabled={savingName}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization Logo</CardTitle>
          <CardDescription>Displayed on certificates. Recommended: PNG with transparent background, 400×200px.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentLogoUrl && (
            <div className="border rounded-md p-4 inline-block bg-muted/30">
              <Image
                src={currentLogoUrl}
                alt="Organization logo"
                width={200}
                height={80}
                className="object-contain max-h-20"
              />
            </div>
          )}
          <div>
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 w-fit">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById("logo-upload")?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {currentLogoUrl ? "Replace Logo" : "Upload Logo"}
                </Button>
              </div>
            </Label>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingLogo}
              onChange={(e) => handleImageUpload(e, "logo")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Signature Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Signature</CardTitle>
          <CardDescription>Displayed on certificates. Recommended: PNG with transparent background, 300×150px.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentSignatureUrl && (
            <div className="border rounded-md p-4 inline-block bg-muted/30">
              <Image
                src={currentSignatureUrl}
                alt="Admin signature"
                width={200}
                height={80}
                className="object-contain max-h-20"
              />
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={uploadingSignature}
              onClick={() => document.getElementById("sig-upload")?.click()}
            >
              {uploadingSignature ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {currentSignatureUrl ? "Replace Signature" : "Upload Signature"}
            </Button>
            <input
              id="sig-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingSignature}
              onChange={(e) => handleImageUpload(e, "signature")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
