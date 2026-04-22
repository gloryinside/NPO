export type PayStatus =
  | "paid"
  | "unpaid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "pending";

export type IncomeStatus = "pending" | "processing" | "confirmed" | "excluded";

export type Payment = {
  id: string;
  org_id: string;
  payment_code: string;
  member_id: string | null;
  promise_id: string | null;
  campaign_id: string | null;
  amount: number;
  pay_date: string | null;
  deposit_date: string | null;
  pay_status: PayStatus;
  income_status: IncomeStatus;
  pg_tx_id: string | null;
  pg_method: string | null;
  fail_reason: string | null;
  receipt_id: string | null;
  toss_payment_key: string | null;
  idempotency_key: string | null;
  receipt_url: string | null;
  requested_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  refund_amount: number | null;
  cancel_reason: string | null;
  retry_count: number | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Joined row returned by payment list endpoint (member + campaign). */
export type PaymentWithRelations = Payment & {
  members?: { id: string; name: string; member_code: string } | null;
  campaigns?: { id: string; title: string } | null;
};
