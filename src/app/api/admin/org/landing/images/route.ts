/**
 * POST /api/admin/org/landing/images — 랜딩 섹션용 이미지 업로드
 *
 * campaign-assets 버킷을 재사용하되 폴더 규약은 `<orgId>/landing/<yyyyMm>/<uuid>.<ext>`.
 * 버킷 정책상 첫 폴더가 orgId면 통과하므로 하위 경로는 자유롭다.
 *
 * 랜딩 이미지는 page_content JSON 안의 URL로만 참조되고 별도 메타 테이블이 없다.
 * 따라서 DB에 row 생성 없이 스토리지만 업로드하고 publicUrl만 반환한다.
 * (섹션 삭제 시 orphan 스토리지가 남지만, 버킷 비용이 낮고 재사용 가능해 허용)
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  validateAssetUpload,
  sanitizeSvg,
} from '@/lib/campaign-builder/assets'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard'

function buildLandingStoragePath(orgId: string, ext: string): string {
  const yyyyMm = new Date().toISOString().slice(0, 7)
  const uuid = crypto.randomUUID()
  return `${orgId}/landing/${yyyyMm}/${uuid}.${ext.replace(/^\./, '')}`
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminOrgForBuilder(req)
  if (!guard.ok) return guard.response
  const { orgId } = guard

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const validation = validateAssetUpload({
    mimeType: file.type,
    sizeBytes: file.size,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = buildLandingStoragePath(orgId, ext)

  let fileBuffer: ArrayBuffer | string
  if (file.type === 'image/svg+xml') {
    fileBuffer = sanitizeSvg(await file.text())
  } else {
    fileBuffer = await file.arrayBuffer()
  }

  const admin = createSupabaseAdminClient()
  const { error: uploadError } = await admin.storage
    .from('campaign-assets')
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 503 })
  }

  const { data: { publicUrl } } = admin.storage
    .from('campaign-assets')
    .getPublicUrl(storagePath)

  return NextResponse.json({ url: publicUrl, path: storagePath }, { status: 201 })
}
