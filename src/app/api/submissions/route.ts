import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** URLs are optional while drafting, so each is validated only if present. */
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Enter a full https:// URL')
  .optional()
  .default('');

const schema = z.object({
  idea_slot: z.coerce.number().int().min(1).max(2),
  ps_id: z.string().trim().max(40).optional().default(''),
  ppt_url: optionalUrl,
  github_url: optionalUrl,
  video_url: optionalUrl,
  architecture_url: optionalUrl,
  /** False saves a draft; true locks the submission timestamp. */
  final: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!rateLimit(`submit:${clientIp(request)}`, 40, 60 * 60 * 1000).allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many submission attempts. Please try again shortly.' },
      { status: 429 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: 'You must be signed in.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
        field: parsed.error.issues[0]?.path.join('.'),
      },
      { status: 422 },
    );
  }

  const { data, error } = await supabase.rpc('submit_idea', { payload: parsed.data });

  if (error) {
    console.error('[submit_idea]', error);
    return NextResponse.json(
      { ok: false, message: 'Could not save your submission. Please try again.' },
      { status: 500 },
    );
  }

  const result = data as
    | { ok: true; submission_id: string; idea_slot: number; final: boolean }
    | { ok: false; code: string; field?: string; message: string };

  if (!result.ok) {
    const status = result.code === 'closed' ? 403 : result.code === 'not_found' ? 404 : 422;
    return NextResponse.json(
      { ok: false, message: result.message, field: result.field },
      { status },
    );
  }

  return NextResponse.json(result);
}
