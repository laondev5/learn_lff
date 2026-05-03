"use client"

import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { LogOut, Menu, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DashboardHeaderProps {
  user: {
    name: string
    email: string
    role: string
    imageUrl?: string | null
  }
  onMenuClick?: () => void
}

export function DashboardHeader({ user, onMenuClick }: DashboardHeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const toastId = toast.loading("Signing out...")

    try {
      await signOut({ redirect: false })
      toast.dismiss(toastId)
      router.replace("/auth/login")
      router.refresh()
    } catch {
      toast.dismiss(toastId)
      toast.error("Sign out failed. Please try again.")
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background px-4 gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 lg:hidden">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="font-bold text-primary text-sm">LFF LMS</span>
      </div>

      <div className="flex-1" />

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
          <UserAvatar name={user.name} imageUrl={user.imageUrl} size="sm" />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-sm font-medium leading-none">{user.name}</span>
            <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
