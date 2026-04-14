"use client"

import { useState } from "react"
import { toast } from "sonner"
import { MoreHorizontal, Loader2, UserCheck, UserX, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toggleUserStatus, deleteUser } from "@/actions/user.actions"

interface UserActionsMenuProps {
  userId: string
  isActive: boolean
}

export function UserActionsMenu({ userId, isActive }: UserActionsMenuProps) {
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
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
