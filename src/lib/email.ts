import "server-only"
import nodemailer from "nodemailer"

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
          <p>Please <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" style="color: #2563eb;">log in</a> and change your password immediately.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 13px; margin: 0;">This email was sent by LFF LMS. Please do not reply.</p>
        </div>
      </body>
    </html>
  `
}
