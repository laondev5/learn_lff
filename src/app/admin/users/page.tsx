import { getUsers } from "@/actions/user.actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserPlus } from "lucide-react"
import { CreateUserDialog } from "@/components/admin/CreateUserDialog"
import { UserActionsMenu } from "@/components/admin/UserActionsMenu"

const kycStatusConfig: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending:     { label: "Pending",      className: "bg-amber-50 text-amber-700 border-amber-200" },
  verified:    { label: "Verified",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:    { label: "Rejected",     className: "bg-red-50 text-red-700 border-red-200" },
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all teachers and students</p>
        </div>
        <CreateUserDialog>
          <Button className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </CreateUserDialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users yet. Add your first user above.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const kyc = kycStatusConfig[user.kycStatus] ?? kycStatusConfig.not_started
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "teacher" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.cohort || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "destructive"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${kyc.className}`}
                          >
                            {kyc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <UserActionsMenu
                            userId={user.id}
                            userName={user.name}
                            isActive={user.isActive}
                            kycStatus={user.kycStatus}
                            kycIdType={user.kycIdType}
                            kycIdNumber={user.kycIdNumber}
                            kycDateOfBirth={user.kycDateOfBirth}
                            kycAddress={user.kycAddress}
                            kycLivePhotoUrl={user.kycLivePhotoUrl}
                            kycSubmittedAt={user.kycSubmittedAt}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
