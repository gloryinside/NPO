import { NextRequest, NextResponse } from 'next/server';
import {
  validateAssetUpload,
  sanitizeSvg,
  buildStoragePath,
} from '@/lib/campaign-builder/assets';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireAdminOrgForBuilder(req, { campaignId: id });
  if (!guard.ok) return guard.response;
  const orgId = guard.orgId;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const validation = validateAssetUpload({
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = buildStoragePath(orgId, ext);

  let fileBuffer: ArrayBuffer | string;
  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    fileBuffer = sanitizeSvg(text);
  } else {
    fileBuffer = await file.arrayBuffer();
  }

  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from('campaign-assets')
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    // Bucket may not exist in some environments — treat as 503
    return NextResponse.json({ error: uploadError.message }, { status: 503 });
  }

  const { data: { publicUrl } } = admin.storage
    .from('campaign-assets')
    .getPublicUrl(storagePath);

  const { data: asset, error: dbError } = await admin
    .from('campaign_assets')
    .insert({
      campaign_id: id,
      org_id: orgId,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      original_name: file.name,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ asset }, { status: 201 });
}
