import { insertPromise } from "@/lib/billing/promise-create";
import { sealBillingKey } from "@/lib/billing/billing-key-store";
import { kstParts, kstToday } from "@/lib/billing/kst";
import { checkRrn } from "@/lib/receipt/validation";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextCode } from "@/lib/codes-seq";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { sendOfflineDonationReceived, sendBillingKeyFailedEmail } from "@/lib/email";
import { deleteBillingKey, issueBillingKey } from "@/lib/billing/toss-billing";
import { getClientIp, normalizeIpForKey, rateLimit, rateLimitAsync } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/http/body";
import { needsBillingRegistration, resolveRegularFlow } from "@/lib/billing/regular-flow";
import { parseDonorProfile, profileColumns } from "@/lib/donations/donor-profile";
import { isPickable, reservationUntil } from "@/lib/sponsorship/pick";
import { resolveAgent, type ActiveAgent } from "@/lib/f2f/agents";
import { resolveAbTag } from "@/lib/ab/form-test-data";
import { consentRows, parseDonationConsents } from "@/lib/legal/consent";
import { parseBasket, singleDesignation, type DesignationOption, type SplitItem } from "@/lib/donations/designation-basket";

/**
 * POST /api/donations/prepare
 *
 * 공개(비로그인) 엔드포인트. Toss 결제 위젯 호출 직전에 호출된다.
 * - 캠페인을 검증하고 (org_id 일치 + status='active')
 * - 후원자를 찾거나 새로 만든다. 이미 있는 후원자의 정보는 바꾸지 않는다 — 로그인 없는 요청이라서.
 *   새 후원자에게만 생년월일·주소·가입 경로를 넣는다(lib/donations/donor-profile).
 * - idempotency_key 와 payment_code 를 발급해 pending payments 행을 생성한다.
 *
 * member_code / payment_code 는 DB 카운터(next_code_seq)로 원자 발번한다.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHILD_TAKEN = "방금 다른 분이 이 아이와 결연을 신청했어요. 다른 아이를 골라 주세요.";

export async function POST(req: NextRequest) {
  // Rate limit: IP 당 분당 10회
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`donations:prepare:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  const tenant = await getTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const {
    campaignId,
    amount,
    memberName,
    memberPhone,
    memberEmail,
    payMethod,
    donationType,
    receiptOptIn,
    residentNo,
    rrnConsent,
    customFields,
    designation,
    idempotencyKey: clientIdempotencyKey,
    cardNumber,
    cardExpirationYear,
    cardExpirationMonth,
    cardPassword,
    customerIdentityNumber,
  } = body as {
    campaignId?: string;
    amount?: number;
    memberName?: string;
    memberPhone?: string;
    memberEmail?: string;
    payMethod?: string;
    donationType?: string;
    receiptOptIn?: boolean;
    residentNo?: string;
    /** 고유식별정보(주민등록번호) 처리 별도 동의 — 개인정보보호법 제24조 */
    rrnConsent?: boolean;
    customFields?: Record<string, unknown>;
    designation?: string;
    /** 여러 사업 담기 — [{ key, amount }] */
    basket?: unknown;
    idempotencyKey?: string;
    cardNumber?: string;
    cardExpirationYear?: string;
    cardExpirationMonth?: string;
    cardPassword?: string;
    customerIdentityNumber?: string;
  };

  if (!campaignId || typeof campaignId !== "string") {
    return NextResponse.json(
      { error: "campaignId는 필수입니다." },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount는 양수여야 합니다." },
      { status: 400 }
    );
  }
  if (!memberName || typeof memberName !== "string" || memberName.trim() === "") {
    return NextResponse.json(
      { error: "후원자 이름은 필수입니다." },
      { status: 400 }
    );
  }

  const phone =
    typeof memberPhone === "string" && memberPhone.trim() !== ""
      ? memberPhone.trim()
      : null;
  const email =
    typeof memberEmail === "string" && memberEmail.trim() !== ""
      ? memberEmail.trim()
      : null;

  const profileParsed = parseDonorProfile(body);
  if (!profileParsed.ok) {
    return NextResponse.json({ error: profileParsed.error }, { status: 400 });
  }
  const profile = profileParsed.value;

  // 필수 동의(약관·개인정보 수집이용·만 14세 이상) — 화면에서 막아도 서버에서 다시 확인하고 기록한다(lib/legal/consent)
  const consentParsed = parseDonationConsents(body.consents, profile.birthDate, kstToday());
  if (!consentParsed.ok) {
    return NextResponse.json({ error: consentParsed.error }, { status: 400 });
  }
  const consents = consentParsed.value;

  const supabase = createSupabaseAdminClient();

  // 1. 캠페인 검증 (테넌트 + active 필수) + 기관 계좌 정보 병렬 조회
  const [
    { data: campaign, error: campaignError },
    { data: orgData, error: orgError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, org_id, title, status, form_settings")
      .eq("id", campaignId)
      .eq("org_id", tenant.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("orgs")
      .select("name, bank_name, bank_account, account_holder, account_billing_enabled")
      .eq("id", tenant.id)
      .maybeSingle(),
  ]);

  if (campaignError) {
    console.error("[donations/prepare] campaign lookup failed:", campaignError.message);
    return NextResponse.json(
      { error: "캠페인 정보를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
  if (orgError) {
    console.error("[donations/prepare] org lookup failed:", orgError.message);
    return NextResponse.json(
      { error: "기관 정보를 조회할 수 없습니다." },
      { status: 500 }
    );
  }
  if (!campaign) {
    return NextResponse.json(
      { error: "유효하지 않은 캠페인입니다." },
      { status: 404 }
    );
  }

  // 1a. 처리 경로 — 정기후원은 lib/billing/regular-flow 가 정한다.
  //     자동이체(cms)는 기관이 토스 계좌 자동결제를 켰을 때만 결제창 등록, 아니면 지금처럼 접수 후 외부 CMS 청구.
  const isRegular = donationType === 'regular';
  const regularFlow = isRegular
    ? resolveRegularFlow({
        payMethod,
        accountBillingEnabled: (orgData as { account_billing_enabled?: boolean } | null)?.account_billing_enabled === true,
        hasCardNumber: !!cardNumber,
      })
    : null;
  if (regularFlow === "unsupported") {
    return NextResponse.json(
      { error: "정기후원은 카드나 자동이체로 신청해 주세요." },
      { status: 400 }
    );
  }
  // 오프라인 결제 수단 (계좌이체·외부 CMS·직접 받음은 Toss PG 불필요)
  const isOfflineMethod = regularFlow
    ? regularFlow === "offline"
    : payMethod === "transfer" || payMethod === "cms" || payMethod === "manual";

  // 1b. 결제수단 서버 사이드 검증 — form_settings.paymentMethods 에 포함돼야 함
  if (payMethod) {
    const fs = campaign.form_settings as { paymentMethods?: string[] } | null;
    const allowedMethods = fs?.paymentMethods ?? [];
    if (allowedMethods.length > 0 && !allowedMethods.includes(payMethod)) {
      return NextResponse.json(
        { error: "허용되지 않은 결제수단입니다." },
        { status: 400 }
      );
    }
  }

  // 1b'. 후원 목적 — 캠페인 설정에 있는 것만 받는다. 여러 사업 담기면 사업별 금액 합이 결제 금액과 같아야 한다.
  const designationOptions =
    ((campaign.form_settings as { designations?: DesignationOption[] } | null)?.designations ?? []);
  let designationValue: string | null = null;
  let designationSplit: SplitItem[] | null = null;
  if (body.basket !== undefined && body.basket !== null) {
    const basket = parseBasket(body.basket, designationOptions);
    if (!basket.ok) return NextResponse.json({ error: basket.error }, { status: 400 });
    if (basket.total !== amount) {
      return NextResponse.json({ error: "사업별 금액의 합이 후원 금액과 다릅니다. 화면을 새로 고쳐 주세요." }, { status: 400 });
    }
    designationSplit = basket.items;
    designationValue = basket.items.length === 1 ? basket.items[0]!.key : null;
  } else {
    const one = singleDesignation(designation, designationOptions);
    if (one) {
      designationValue = one.key;
      designationSplit = [{ key: one.key, label: one.label, amount, programId: one.programId ?? null }];
    }
  }

  // 1b'''. 현장 모금(태블릿) — 링크 토큰이 이 캠페인 모금가 것이면 신청에 모금가를 붙인다. 토큰이 틀리면 받지 않는다.
  let f2fAgent: ActiveAgent | null = null;
  if (body.f2fToken !== undefined && body.f2fToken !== null) {
    f2fAgent = await resolveAgent(supabase, tenant.id, body.f2fToken);
    if (!f2fAgent || f2fAgent.campaignId !== campaign.id) {
      return NextResponse.json({ error: "현장 모금 링크가 만료되었거나 중지되었습니다. 담당자에게 새 링크를 받아 주세요." }, { status: 403 });
    }
  }

  // 1b''''. 신청 화면 A/B 비교 — 진행 중인 실험이면 신청에 안을 붙인다(안은 방문자 id로 서버가 다시 정함)
  const abTag = f2fAgent ? null : await resolveAbTag(supabase, tenant.id, campaign.id, body.abTestId, body.abVisitorId);

  // 1b''. 결연 아동 선택 — 정기후원이고 캠페인이 켰을 때만. 지금 고를 수 있는 아이인지 먼저 본다(최종 확보는 약정 생성 뒤)
  const beneficiaryId = typeof body.beneficiaryId === "string" && UUID_RE.test(body.beneficiaryId) ? body.beneficiaryId : null;
  if (body.beneficiaryId !== undefined && body.beneficiaryId !== null && !beneficiaryId) {
    return NextResponse.json({ error: "결연할 아이 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (beneficiaryId) {
    const fs = campaign.form_settings as { sponsorshipPick?: boolean; sponsorshipProgramId?: string | null } | null;
    if (!isRegular || !fs?.sponsorshipPick) {
      return NextResponse.json({ error: "결연은 정기후원으로만 신청할 수 있어요." }, { status: 400 });
    }
    const { data: child } = await supabase
      .from("beneficiaries")
      .select("status, public_listing, reserved_until, program_id")
      .eq("id", beneficiaryId)
      .eq("org_id", tenant.id)
      .maybeSingle();
    if (!child || !isPickable(child) || (fs.sponsorshipProgramId && child.program_id !== fs.sponsorshipProgramId)) {
      return NextResponse.json({ error: CHILD_TAKEN }, { status: 409 });
    }
    // 돈이 오가기 전부터 아이를 잡아 두므로 한 곳에서 여러 아이를 묶지 못하게 한다.
    // 서버가 여러 대여도 같이 세도록 공유 저장소(Redis)를 쓰고, IPv6는 /64 대역으로 묶는다.
    // (근본적으로는 휴대폰 인증 뒤에 잡아 두는 것 — 문자 연동 때 붙인다)
    const holdLimit = await rateLimitAsync(`donations:child-hold:${normalizeIpForKey(ip)}`, 3, 60 * 60_000);
    if (!holdLimit.allowed) {
      return NextResponse.json({ error: "잠시 후 다시 신청해 주세요." }, { status: 429 });
    }
  }

  // 1c. 테넌트별 Toss client key 로드 — 오프라인 결제는 Toss 불필요
  let tossClientKey: string | null = null;
  if (!isOfflineMethod) {
    const keys = await getOrgTossKeys(tenant.id);
    tossClientKey = keys.tossClientKey;
    if (!tossClientKey) {
      return NextResponse.json(
        { error: "이 기관은 결제 설정이 되어있지 않습니다." },
        { status: 400 }
      );
    }
  }

  // 2. 기존 member 검색 — phone 우선, 없으면 email 로 매칭
  let memberId: string | null = null;
  type ExistingMember = {
    id: string;
    email: string | null;
    birth_date: string | null;
    postal_code: string | null;
    address_line1: string | null;
    address_line2: string | null;
    join_path: string | null;
  };
  const memberCols = "id, email, birth_date, postal_code, address_line1, address_line2, join_path";
  let existing: ExistingMember | null = null;

  if (phone) {
    const { data: byPhone } = await supabase
      .from("members")
      .select(memberCols)
      .eq("org_id", tenant.id)
      .eq("phone", phone)
      .maybeSingle();
    existing = (byPhone as ExistingMember | null) ?? null;
  }

  if (!existing && email) {
    const { data: byEmail } = await supabase
      .from("members")
      .select(memberCols)
      .eq("org_id", tenant.id)
      .eq("email", email)
      .maybeSingle();
    existing = (byEmail as ExistingMember | null) ?? null;
  }

  if (existing) {
    // 로그인 없는 신청서로는 이미 있는 후원자 정보를 바꾸지 않는다(빈칸 채우기도 하지 않는다).
    // 휴대폰·이메일만 알면 남의 기록에 이메일·주소를 심을 수 있기 때문 — 변경은 마이페이지·관리자 화면에서.
    // (예전엔 휴대폰만 맞으면 이메일을 덮어써 영수증이 남에게 갈 수 있었다)
    memberId = existing.id;
  }

  // 3. 없으면 새 member 생성
  if (!memberId) {
    const year = new Date().getFullYear();
    let memberCode: string;
    try {
      memberCode = await nextCode(supabase, tenant.id, "member", year);
    } catch (e) {
      console.error("[donations/prepare] member code:", (e as Error).message);
      return NextResponse.json(
        { error: "후원자 정보 조회 실패" },
        { status: 500 }
      );
    }

    const { data: newMember, error: memberInsertError } = await supabase
      .from("members")
      .insert({
        org_id: tenant.id,
        member_code: memberCode,
        name: memberName.trim(),
        phone,
        email,
        ...profileColumns(profile),
        // 마케팅 동의는 새 후원자에게만 — 로그인 없는 신청서로 기존 후원자의 동의를 바꾸지 않는다(변경은 마이페이지)
        marketing_consent: consents.marketing,
        marketing_consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (memberInsertError || !newMember) {
      console.error("[donations/prepare] member insert:", memberInsertError?.message);
      return NextResponse.json(
        { error: "후원자 생성 실패" },
        { status: 500 }
      );
    }
    memberId = newMember.id as string;
  }

  // 4. payment_code 생성 (기관·연도 카운터 — 동시 요청에도 중복 없음)
  const year = new Date().getFullYear();
  let paymentCode: string;
  try {
    paymentCode = await nextCode(supabase, tenant.id, "payment", year);
  } catch (e) {
    console.error("[donations/prepare] payment code:", (e as Error).message);
    return NextResponse.json(
      { error: "결제 정보 조회 실패" },
      { status: 500 }
    );
  }
  // Use client-supplied idempotency key if provided (wizard sends one), otherwise generate
  const idempotencyKey =
    typeof clientIdempotencyKey === "string" && clientIdempotencyKey.trim()
      ? clientIdempotencyKey.trim()
      : randomUUID();
  const nowIso = new Date().toISOString();
  // KST 날짜 — UTC로 자르면 1/1 00~09시 후원이 전년도 영수증으로 넘어간다
  const payDate = kstToday();

  // 5a. RRN 암호화 (기부금 영수증 신청 시)
  // pgp_sym_encrypt를 DB RPC로 호출해 BYTEA 값을 미리 계산한다.
  // 암호화 키는 RECEIPTS_ENCRYPTION_KEY 환경변수에서 로드.
  let rrnPendingEncrypted: string | null = null; // base64 or null
  const wantsReceipt = receiptOptIn === true;
  const rawRrn = typeof residentNo === "string" ? residentNo.replace(/-/g, "").trim() : "";
  const encKeyForId = process.env.RECEIPTS_ENCRYPTION_KEY;
  if (wantsReceipt && profile.donorType === "corporate") {
    // 기업 후원자 — 영수증 기부자 번호는 사업자등록번호(고유식별정보가 아니라 별도 동의 불필요).
    // 같은 칸(주민등록번호 자리)에 같은 방식으로 암호화해 두면 국세청 자료(nts-dataset)가 10자리를 법인으로 처리한다.
    if (!profile.businessNo) {
      return NextResponse.json({ error: "영수증을 받으려면 사업자등록번호를 입력해 주세요." }, { status: 400 });
    }
    if (!encKeyForId) {
      return NextResponse.json({ error: "영수증 암호화 설정이 누락되었습니다. 관리자에게 문의하세요." }, { status: 500 });
    }
    const { data: encBiz, error: encBizErr } = await supabase.rpc("encrypt_rrn_pending", { plaintext: profile.businessNo, passphrase: encKeyForId });
    if (encBizErr) return NextResponse.json({ error: "사업자등록번호 암호화 실패" }, { status: 500 });
    rrnPendingEncrypted = encBiz as string | null;
  } else if (wantsReceipt && rawRrn) {
    // 별도 동의 없이는 받지 않는다(고유식별정보 처리 동의는 다른 동의와 분리해야 한다)
    if (rrnConsent !== true) {
      return NextResponse.json(
        { error: "주민등록번호 수집·이용(고유식별정보 처리)에 동의해 주세요." },
        { status: 400 }
      );
    }
    // 형식·생년월일·성별 자리 검증(2020-10 이후 번호는 체크섬이 없어 체크섬은 보지 않는다)
    const rrnCheck = checkRrn(rawRrn);
    if (!rrnCheck.ok) {
      return NextResponse.json(
        { error: rrnCheck.reason === "format" ? "주민등록번호는 13자리 숫자여야 합니다." : "주민등록번호를 다시 확인해 주세요." },
        { status: 400 }
      );
    }
    const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
    if (!encKey) {
      return NextResponse.json(
        { error: "영수증 암호화 설정이 누락되었습니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }
    const { data: encData, error: encError } = await supabase.rpc(
      "encrypt_rrn_pending",
      { plaintext: rawRrn, passphrase: encKey }
    );
    if (encError) {
      return NextResponse.json(
        { error: "RRN 암호화 실패: " + encError.message },
        { status: 500 }
      );
    }
    rrnPendingEncrypted = encData as string | null;
  }

  // 5b. pending payments 행 생성
  const { data: payment, error: paymentInsertError } = await supabase
    .from("payments")
    .insert({
      org_id: tenant.id,
      payment_code: paymentCode,
      member_id: memberId,
      campaign_id: campaign.id,
      amount,
      pay_date: payDate,
      pay_status: "pending",
      income_status: "pending",
      idempotency_key: idempotencyKey,
      requested_at: nowIso,
      receipt_opt_in: wantsReceipt,
      // 주민번호(기업은 사업자번호)는 결제 행에만 둔다 — 돈이 들어온 게 확인되면 후원자에게 옮긴다(lib/receipt/pending-id)
      ...(rrnPendingEncrypted ? { rrn_pending_encrypted: rrnPendingEncrypted, rrn_consent_at: new Date().toISOString() } : {}),
      ...(payMethod ? { pay_method: payMethod } : {}),
      ...(customFields ? { custom_fields: customFields } : {}),
      ...(designationValue ? { designation: designationValue } : {}),
      ...(designationSplit ? { designation_split: designationSplit } : {}),
      ...(abTag ?? {}),
      // 현장 모금은 유입 경로를 모금가로 고정한다(유입 분석·실적 집계)
      ...(f2fAgent
        ? { f2f_agent_id: f2fAgent.id, utm_source: "f2f", utm_medium: "tablet", utm_campaign: f2fAgent.code }
        : {
            ...(typeof body.utmSource === "string" ? { utm_source: body.utmSource } : {}),
            ...(typeof body.utmMedium === "string" ? { utm_medium: body.utmMedium } : {}),
            ...(typeof body.utmCampaign === "string" ? { utm_campaign: body.utmCampaign } : {}),
          }),
      ...(typeof body.utmContent === "string" ? { utm_content: body.utmContent } : {}),
      ...(typeof body.utmTerm === "string" ? { utm_term: body.utmTerm } : {}),
      ...(typeof body.referrer === "string" ? { referrer: String(body.referrer).slice(0, 500) } : {}),
      ...(typeof body.landingUrl === "string" ? { landing_url: String(body.landingUrl).slice(0, 500) } : {}),
    })
    .select("id, payment_code, amount, idempotency_key")
    .single();

  if (paymentInsertError || !payment) {
    console.error("[donations/prepare] payment insert:", paymentInsertError?.message);
    return NextResponse.json(
      { error: "결제 준비 실패" },
      { status: 500 }
    );
  }

  // 5c. 동의 기록 — 신청 한 건마다 문구 판과 함께 남긴다(입증용)
  {
    const { error: consentErr } = await supabase.from("consent_records").insert(
      consentRows({
        orgId: tenant.id,
        memberId,
        paymentId: payment.id,
        consents,
        rrn: !!rrnPendingEncrypted,
        source: f2fAgent ? "f2f" : "donation_form",
      }),
    );
    if (consentErr) console.error("[donations/prepare] consent records:", consentErr.message);
  }

  // 6. 정기후원: 빌링키 발급 + promise 생성
  let regularBillingKeyFailed = false;
  // [표준] 결제창 카드 등록 — 카드번호가 오지 않은 카드 정기후원은 토스 결제창(requestBillingAuth)으로
  // 카드를 등록한다. 카드 정보가 우리 서버를 거치지 않는다. 키인(카드번호 직접 전송)은 하위 호환으로만.
  let billingAuth: { customerKey: string; promiseId: string; method: 'card' | 'account' } | null = null;

  if (isRegular && memberId) {
    const todayDay = kstParts().day; // KST 기준(서버 UTC와 무관)
    const customerKey = randomUUID();
    let billingKey: string | null = null;
    const sdkBilling = regularFlow !== null && needsBillingRegistration(regularFlow);

    // 카드 정보가 있으면 빌링키 발급 시도
    if (cardNumber && cardExpirationYear && cardExpirationMonth && cardPassword && customerIdentityNumber) {
      const keys = await getOrgTossKeys(tenant.id);
      if (keys.tossSecretKey) {
        const result = await issueBillingKey(keys.tossSecretKey, customerKey, {
          cardNumber,
          cardExpirationYear,
          cardExpirationMonth,
          cardPassword,
          customerIdentityNumber,
        });
        if (result.success) {
          billingKey = result.billingKey;
        } else {
          console.warn('[donations/prepare] 빌링키 발급 실패:', result.error);
          regularBillingKeyFailed = true;
          // 카드 등록 실패 즉시 후원자에게 이메일 알림 (fire-and-forget)
          if (email) {
            const org = orgData as { name?: string } | null;
            sendBillingKeyFailedEmail({
              orgId: tenant.id,
              to: email,
              memberName: (memberName as string | undefined)?.trim() ?? '후원자',
              orgName: org?.name ?? tenant.name,
            });
          }
        }
      }
    }

    // billingKey 발급 실패 시 promise는 pending_billing 상태로 생성 —
    // active로 두면 processMonthlyCharges가 null billingKey로 청구를 시도해 매월 실패함.
    // pending_billing 상태는 관리자가 카드 재등록 후 active로 전환.
    // 빌링키는 암호화해 저장(DB 유출 = 즉시 결제 가능 방지)
    const created = await insertPromise(supabase, tenant.id, {
      member_id: memberId,
      campaign_id: campaign.id,
      type: 'regular',
      amount,
      pay_day: Math.min(todayDay, 28),
      pay_method: payMethod ?? 'card',
      status: billingKey ? 'active' : 'pending_billing',
      toss_billing_key: billingKey ? await sealBillingKey(billingKey) : null,
      // 결제창 방식은 등록 완료 콜백에서 같은 customerKey로 빌링키를 발급하므로 미리 저장
      customer_key: billingKey || sdkBilling ? customerKey : null,
      // 매달 만드는 결제에 후원 목적·사업별 금액을 그대로 옮긴다(process-payments)
      designation: designationValue,
      designation_split: designationSplit,
      f2f_agent_id: f2fAgent?.id ?? null,
      ...(abTag ?? {}),
    });
    if ('error' in created) {
      // 약정 저장 실패 — 방금 발급한 빌링키를 토스에서 지워 고아 키를 남기지 않는다
      console.error('[donations/prepare] promise insert:', created.error);
      if (billingKey) {
        const keys = await getOrgTossKeys(tenant.id);
        if (keys.tossSecretKey) await deleteBillingKey(keys.tossSecretKey, billingKey);
      }
      return NextResponse.json({ error: '정기후원 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    // 고른 아이를 이 약정 몫으로 잡는다 — 그 사이 다른 신청이 먼저 잡았으면 약정·결제를 거두고 다시 고르게 한다.
    // 결연은 약정이 유효해지거나 첫 결제가 되면 DB 트리거(start_requested_sponsorship)가 만든다.
    if (beneficiaryId) {
      // 같은 후원자는 결연 신청을 하나씩만 진행한다(이전 신청이 끝나거나 기한이 지나면 다시)
      const { data: myPromises } = await supabase
        .from("promises")
        .select("id")
        .eq("org_id", tenant.id)
        .eq("member_id", memberId)
        .neq("id", created.id)
        .not("beneficiary_id", "is", null)
        .in("status", ["pending_billing"]);
      const myIds = (myPromises ?? []).map((p) => p.id as string);
      const { count: myHolds } = myIds.length
        ? await supabase
            .from("beneficiaries")
            .select("id", { count: "exact", head: true })
            .eq("org_id", tenant.id)
            .in("reserved_promise_id", myIds)
            .gt("reserved_until", new Date().toISOString())
        : { count: 0 };
      const { data: reserved } = (myHolds ?? 0) > 0
        ? { data: false }
        : await supabase.rpc("reserve_beneficiary", {
        p_org: tenant.id,
        p_beneficiary: beneficiaryId,
        p_promise: created.id,
        p_until: reservationUntil(new Date(), !!f2fAgent),
      });
      if (reserved !== true) {
        await supabase.from("promises").update({ status: "cancelled" }).eq("id", created.id).eq("org_id", tenant.id);
        await supabase.from("payments").update({ pay_status: "cancelled", fail_reason: "결연 아동 선점" }).eq("id", payment.id).eq("org_id", tenant.id);
        if (billingKey) {
          const keys = await getOrgTossKeys(tenant.id);
          if (keys.tossSecretKey) await deleteBillingKey(keys.tossSecretKey, billingKey);
        }
        return NextResponse.json({ error: CHILD_TAKEN }, { status: 409 });
      }
      const { error: linkChildErr } = await supabase
        .from("promises")
        .update({ beneficiary_id: beneficiaryId })
        .eq("id", created.id)
        .eq("org_id", tenant.id);
      if (linkChildErr) console.error("[donations/prepare] promise beneficiary link:", linkChildErr.message);
    }
    if (sdkBilling) {
      billingAuth = { customerKey, promiseId: created.id, method: regularFlow === 'account_billing' ? 'account' : 'card' };
    }
    // 자동이체(외부 CMS) 정기 — 신청 때 만든 결제를 이 약정의 첫 달 결제로 만든다.
    //  - 약정에 연결해 청구 화면에서 출금동의 여부가 보이게 하고, 30분 뒤 미완료 정리 작업에서도 빠지게 한다
    //  - 매월 결제 생성 작업과 같은 중복 방지 키를 써서 같은 달 결제가 두 번 생기지 않게 한다
    if (regularFlow === 'offline' && payMethod === 'cms') {
      const { year: y, month: m } = kstParts();
      const { error: linkErr } = await supabase
        .from('payments')
        .update({ promise_id: created.id, idempotency_key: `cron-${created.id}-${y}-${String(m).padStart(2, '0')}` })
        .eq('id', payment.id)
        .eq('org_id', tenant.id);
      if (linkErr) console.error('[donations/prepare] cms first payment link:', linkErr.message);
    }
  }

  // 오프라인 결제: Toss 리디렉션 없이 계좌 안내 정보 반환
  if (isOfflineMethod) {
    const org = orgData as {
      name?: string;
      bank_name?: string | null;
      bank_account?: string | null;
      account_holder?: string | null;
    } | null;
    const bankName = org?.bank_name ?? null;
    const bankAccount = org?.bank_account ?? null;
    const accountHolder = org?.account_holder ?? null;

    // 접수 확인 이메일 (fire-and-forget)
    if (email) {
      sendOfflineDonationReceived({
        orgId: tenant.id,
        to: email,
        memberName: memberName.trim(),
        orgName: org?.name ?? tenant.name,
        campaignTitle: campaign.title,
        amount,
        paymentCode: payment.payment_code,
        payMethod: (payMethod as "transfer" | "cms" | "manual") ?? "transfer",
        donationType: (donationType as "onetime" | "regular") ?? "onetime",
        bankName,
        bankAccount,
        accountHolder,
      });
    }

    return NextResponse.json({
      offline: true,
      payMethod: payMethod ?? "transfer",
      donationType: donationType ?? "onetime",
      paymentId: payment.id,
      paymentCode: payment.payment_code,
      amount: payment.amount,
      orderName: campaign.title,
      memberName: memberName.trim(),
      bankName,
      bankAccount,
      accountHolder,
    });
  }

  return NextResponse.json({
    orderId: payment.idempotency_key,
    paymentId: payment.id,
    paymentCode: payment.payment_code,
    amount: payment.amount,
    memberName: memberName.trim(),
    customerName: memberName.trim(),
    customerEmail: email,
    memberEmail: email,
    orderName: campaign.title,
    tossClientKey,
    ...(regularBillingKeyFailed ? { billingKeyFailed: true } : {}),
    ...(billingAuth ? { billingAuth } : {}),
  });
}
