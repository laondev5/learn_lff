"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  IdCard,
  CalendarDays,
  MapPin,
  Camera,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { reviewKyc } from "@/actions/user.actions"

interface KycReviewDialogProps {
  userId: string
  userName: string
  kycStatus: string
  kycIdType?: string
  kycIdNumber?: string
  kycDateOfBirth?: string
  kycAddress?: string
  kycLivePhotoUrl?: string
  kycSubmittedAt?: string
  children: React.ReactNode
}

const kycStatusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending:     { label: "Pending Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  verified:    { label: "Verified", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:    { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
}

const idTypeLabels: Record<string, string> = {
  nin: "National ID (NIN)",
  passport: "International Passport",
  driver_license: "Driver's License",
  voter_card: "Voter's Card",
}

export function KycReviewDialog({
  userId,
  userName,
  kycStatus,
  kycIdType,
  kycIdNumber,
  kycDateOfBirth,
  kycAddress,
  kycLivePhotoUrl,
  kycSubmittedAt,
  children,
}: KycReviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [currentStatus, setCurrentStatus] = useState(kycStatus)

  const statusConfig = kycStatusConfig[currentStatus] ?? kycStatusConfig.not_started
  const hasSubmission = !!kycLivePhotoUrl

  async function handleDecision(decision: "verified" | "rejected") {
    setLoading(decision === "verified" ? "approve" : "reject")
    const result = await reviewKyc(userId, decision)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCurrentStatus(decision)
      toast.success(
        decision === "verified"
          ? `${userName}'s KYC has been approved.`
          : `${userName}'s KYC has been rejected.`
      )
    }
    setLoading(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            KYC Review — {userName}
          </DialogTitle>
        </DialogHeader>

        {/* Status banner */}
        <div className="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/40">
          <span className="text-sm text-muted-foreground font-medium">Current Status</span>
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2.5 py-0.5 ${statusConfig.className}`}
          >
            {statusConfig.label}
          </Badge>
        </div>

        {!hasSubmission ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            This user has not submitted their KYC documents yet.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Submitted at */}
            {kycSubmittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted on{" "}
                {new Date(kycSubmittedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}

            <Separator />

            {/* Details grid */}
            <div className="space-y-3">
              {kycIdType && (
                <div className="flex items-start gap-3">
                  <IdCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">ID Type</p>
                    <p className="text-sm font-medium">
                      {idTypeLabels[kycIdType] ?? kycIdType}
                    </p>
                  </div>
                </div>
              )}

              {kycIdNumber && (
                <div className="flex items-start gap-3">
                  <IdCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">ID Number</p>
                    <p className="text-sm font-medium font-mono tracking-wider">{kycIdNumber}</p>
                  </div>
                </div>
              )}

              {kycDateOfBirth && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="text-sm font-medium">
                      {new Date(kycDateOfBirth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {kycAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-medium">{kycAddress}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Live photo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Live Photo</p>
              </div>
              <div className="rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={kycLivePhotoUrl}
                  alt="KYC live photo"
                  className="w-full max-h-72 object-contain"
                />
              </div>
            </div>

            {/* Approve / Reject — only shown when pending */}
            {currentStatus === "pending" && (
              <>
                <Separator />
                <div className="flex gap-3 pt-1">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleDecision("verified")}
                    disabled={loading !== null}
                  >
                    {loading === "approve" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleDecision("rejected")}
                    disabled={loading !== null}
                  >
                    {loading === "reject" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
