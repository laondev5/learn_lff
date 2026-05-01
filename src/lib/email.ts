import "server-only"
import nodemailer from "nodemailer"
import { getAppUrl } from "@/lib/app-url"

const port = Number(process.env.EMAIL_PORT) || 587

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: port,
  secure: port === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  })
}

export function credentialsEmailHtml(name: string, email: string, password: string) {
  const appUrl = getAppUrl()

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Your LFF LMS Account</title>
      </head>
      <body style="font-family: sans-serif; background: #f4f4f4; padding: 24px;">
        <div style="max-width: 520px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #1e293b; margin-top: 0;">Welcome to LFF Learning Management System</h2>
          <p>Hi <strong>${name}</strong>,</p>
          <p>Your account has been created. Here are your login credentials:</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
          </div>
          <p>Please <a href="${appUrl}/auth/login" style="color: #2563eb;">log in</a> and change your password immediately.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px; margin: 0;">This email was sent by LFF LMS. Please do not reply.</p>
        </div>
      </body>
    </html>
  `
}

export function urgentQuestionEmailHtml(teacherName: string, studentName: string, courseTitle: string, questionTitle: string, questionContent: string) {
  const appUrl = getAppUrl()

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Urgent Question in Your Course</title>
      </head>
      <body style="font-family: sans-serif; background: #f4f4f4; padding: 24px;">
        <div style="max-width: 520px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #b91c1c; margin-top: 0;">Urgent Question Notification</h2>
          <p>Hi <strong>${teacherName}</strong>,</p>
          <p>A student, <strong>${studentName}</strong>, has asked an urgent question in your course, <strong>${courseTitle}</strong>.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-weight: 600; color: #991b1b;">Title: ${questionTitle}</p>
            <p style="margin: 8px 0 0; color: #4b5563;">${questionContent}</p>
          </div>
          <p>Please log in to your dashboard to provide a response as soon as possible.</p>
          <p><a href="${appUrl}/teacher/courses" style="color: #2563eb; text-decoration: none; font-weight: 500;">View Course Q&A</a></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px; margin: 0;">This email was sent by LFF LMS. Please do not reply.</p>
        </div>
      </body>
    </html>
  `
}

export function accountabilityPartnerWelcomeEmailHtml(partnerName: string, studentName: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Accountability Partner Welcome</title>
      </head>
      <body style="font-family: sans-serif; background: #f4f4f4; padding: 24px;">
        <div style="max-width: 520px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #1e293b; margin-top: 0;">Accountability Partner Invitation</h2>
          <p>Hi <strong>${partnerName}</strong>,</p>
          <p>You have been assigned as an accountability partner for <strong>${studentName}</strong> on the LFF Learning Management System.</p>
          <p>Your role is to support and encourage <strong>${studentName}</strong> throughout their learning journey. If they encounter challenges or remain inactive for an extended period, you will receive notifications to help follow up with them.</p>
          <p>Thank you for your commitment to their growth!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px; margin: 0;">This email was sent by LFF LMS. Please do not reply.</p>
        </div>
      </body>
    </html>
  `
}

export function studentStuckEmailHtml(partnerName: string, studentName: string, courseTitle: string, hours: number) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Student Progress Update</title>
      </head>
      <body style="font-family: sans-serif; background: #f4f4f4; padding: 24px;">
        <div style="max-width: 520px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #b91c1c; margin-top: 0;">Follow-up Required: ${studentName}</h2>
          <p>Hi <strong>${partnerName}</strong>,</p>
          <p>This is an automated notification to let you know that <strong>${studentName}</strong> has not made any progress in their course, <strong>${courseTitle}</strong>, for more than <strong>${hours} hours</strong>.</p>
          <p>Please take a moment to follow up with them and see if they need any assistance or encouragement to continue their learning.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0; color: #991b1b;">
            <p style="margin: 0; font-weight: 600;">Student: ${studentName}</p>
            <p style="margin: 4px 0 0;">Course: ${courseTitle}</p>
            <p style="margin: 4px 0 0;">Inactivity Period: ${hours} hours</p>
          </div>
          <p>Your support makes a difference!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px; margin: 0;">This email was sent by LFF LMS. Please do not reply.</p>
        </div>
      </body>
    </html>
  `
}
