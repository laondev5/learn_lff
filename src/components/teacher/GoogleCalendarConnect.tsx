"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CheckCircle2, AlertCircle } from "lucide-react"
import Link from "next/link"

interface GoogleCalendarConnectProps {
  isConnected: boolean
}

export function GoogleCalendarConnect({ isConnected }: GoogleCalendarConnectProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Connect your Google account to automatically generate Meet links for live classes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
            <CheckCircle2 className="h-5 w-5" />
            <div className="text-sm">
              <p className="font-semibold">Connected</p>
              <p>Your Google Calendar is ready for live classes.</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" asChild>
              <Link href="/api/auth/google">Reconnect</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Not Connected</p>
                <p>You need to connect your Google account to schedule live classes.</p>
              </div>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/api/auth/google">Connect Google Calendar</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
