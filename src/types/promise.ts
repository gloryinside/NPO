export type PromiseType = "regular" | "onetime";
export type PromiseStatus =
  | "active"
  | "suspended"
  | "cancelled"
  | "completed"
  | "pending_billing";

export type Promise = {
  id: string;
  org_id: string;
  promise_code: string;
  member_id: string;
  campaign_id: string | null;
  type: PromiseType;
  amount: number;
  pay_day: number | null;
  pay_method: string | null;
  status: PromiseStatus;
  toss_billing_key: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Joined row returned by promise list endpoint (member + campaign). */
export type PromiseWithRelations = Promise & {
  members?: { id: string; name: string; member_code: string } | null;
  campaigns?: { id: string; title: string } | null;
};
