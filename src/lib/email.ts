import { Resend } from 'resend';

/**
 * Confirmation mail. Configured through env vars so the deployment can
 * point at Resend or any SMTP relay Supabase is wired to. When no API key
 * is present (local development), sends are logged and skipped rather
 * than failing the registration.
 */

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM ?? 'PIEMR Hackathon <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

export interface RegistrationEmailData {
  teamIdShort: string;
  teamName: string;
  members: Array<{ full_name: string; email: string; is_lead: boolean; enrollment_number: string }>;
  primaryMentor: { full_name: string; email: string };
  secondaryMentor?: { full_name: string; email: string } | null;
  eventName: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(data: RegistrationEmailData): string {
  const rows = data.members
    .map(
      (m, i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
            ${escapeHtml(m.full_name)}${m.is_lead ? ' <strong>(Team Lead)</strong>' : ''}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.enrollment_number)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.email)}</td>
        </tr>`,
    )
    .join('');

  return `
  <div style="font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="background:linear-gradient(135deg,#0f1a57,#1743f5);padding:28px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;color:#c7d7ff;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">
        ${escapeHtml(data.eventName)}
      </p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:24px;">Registration confirmed</h1>
    </div>

    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <p style="margin:0 0 16px;">Hello,</p>
      <p style="margin:0 0 20px;">
        Your team <strong>${escapeHtml(data.teamName)}</strong> is registered for the
        ${escapeHtml(data.eventName)}.
      </p>

      <div style="background:#eef4ff;border:1px solid #bcd2ff;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#1233e1;letter-spacing:.08em;text-transform:uppercase;">Your Team ID</p>
        <p style="margin:4px 0 0;font-size:38px;font-weight:700;letter-spacing:.12em;color:#0f1a57;">
          ${escapeHtml(data.teamIdShort)}
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#475569;">
          Quote this ID at the presentation — judges use it to pull up your submission.
        </p>
      </div>

      <h3 style="margin:0 0 8px;font-size:15px;">Team members</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px 12px;">#</th>
            <th style="padding:8px 12px;">Name</th>
            <th style="padding:8px 12px;">Enrollment</th>
            <th style="padding:8px 12px;">Email</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <h3 style="margin:0 0 8px;font-size:15px;">Mentors</h3>
      <p style="margin:0 0 20px;font-size:13px;">
        Primary: ${escapeHtml(data.primaryMentor.full_name)} (${escapeHtml(data.primaryMentor.email)})
        ${
          data.secondaryMentor
            ? `<br/>Secondary: ${escapeHtml(data.secondaryMentor.full_name)} (${escapeHtml(data.secondaryMentor.email)})`
            : ''
        }
      </p>

      <p style="margin:0 0 4px;font-size:13px;color:#475569;">
        The team lead can edit these details from their dashboard until registration closes.
        Problem statement selection, submission deadlines and the event date will be announced
        on the portal.
      </p>
    </div>
  </div>`;
}

export async function sendRegistrationEmail(
  recipients: string[],
  data: RegistrationEmailData,
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    console.info(
      `[email] RESEND_API_KEY unset — skipping confirmation for team ${data.teamIdShort} to ${recipients.length} recipients`,
    );
    return { sent: false, error: 'email_not_configured' };
  }

  try {
    // One message per member so no participant sees the others' addresses
    // in a shared To: header.
    const results = await Promise.allSettled(
      recipients.map((to) =>
        resend.emails.send({
          from: fromAddress,
          to,
          subject: `Team ${data.teamIdShort} registered — ${data.eventName}`,
          html: buildHtml(data),
        }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      return { sent: true, error: `${failed} of ${recipients.length} confirmation emails failed` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'send_failed' };
  }
}
