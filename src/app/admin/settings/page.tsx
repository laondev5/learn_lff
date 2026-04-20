import { getSystemConfig } from "@/actions/system.actions"
import { SystemSettingsForm } from "@/components/admin/SystemSettingsForm"

export default async function SettingsPage() {
  const config = await getSystemConfig()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure organization details, logo, and signature for certificates
        </p>
      </div>
      <SystemSettingsForm
        organizationName={config.organizationName}
        logoUrl={config.logoUrl}
        signatureUrl={config.signatureUrl}
        stuckDurationHours={config.stuckDurationHours ?? 72}
      />
    </div>
  )
}
