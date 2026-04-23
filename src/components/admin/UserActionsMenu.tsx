"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  MoreHorizontal,
  Loader2,
  UserCheck,
  UserX,
  Trash2,
  ShieldCheck,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toggleUserStatus, deleteUser } from "@/actions/user.actions"
import { KycReviewDialog } from "@/components/admin/KycReviewDialog"

interface UserActionsMenuProps {
  userId: string
  userName: string
  isActive: boolean
  kycStatus: string
  kycIdType?: string
  kycIdNumber?: string
  kycDateOfBirth?: string
  kycAddress?: string
  kycLivePhotoUrl?: string
  kycSubmittedAt?: string
}

export function UserActionsMenu({
  userId,
  userName,
  isActive,
  kycStatus,
  kycIdType,
  kycIdNumber,
  kycDateOfBirth,
  kycAddress,
  kycLivePhotoUrl,
  kycSubmittedAt,
}: UserActionsMenuProps) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const result = await toggleUserStatus(userId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(result.isActive ? "User activated" : "User deactivated")
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to permanently delete this user?")) return
    setLoading(true)
    const result = await deleteUser(userId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("User deleted")
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* KYC Review button — always visible */}
      <KycReviewDialog
        userId={userId}
        userName={userName}
        kycStatus={kycStatus}
        kycIdType={kycIdType}
        kycIdNumber={kycIdNumber}
        kycDateOfBirth={kycDateOfBirth}
        kycAddress={kycAddress}
        kycLivePhotoUrl={kycLivePhotoUrl}
        kycSubmittedAt={kycSubmittedAt}
      >
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          View KYC
        </Button>
      </KycReviewDialog>

      {/* More options dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={loading} />}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleToggle}>
            {isActive ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
