export interface DashboardActivePromise {
  id: string
  amount: number
  pay_day: number | null
  campaigns: { id: string; title: string } | null
}

export interface DashboardRecentPayment {
  id: string
  amount: number
  pay_date: string | null
  pay_status: string
  campaigns: { id: string; title: string } | null
}

export interface DashboardLatestReceipt {
  id: string
  year: number
  total_amount: number
  pdf_url: string | null
}

export interface DashboardUpcomingPayment {
  promise_id: string
  campaign_title: string | null
  amount: number
  scheduled_date: string
}

export interface DashboardExpiringCard {
  promise_id: string
  campaign_title: string | null
  expiry_year: number
  expiry_month: number
  days_until_expiry: number
}

export interface DonorDashboardSnapshot {
  active_promises: DashboardActivePromise[]
  recent_payments: DashboardRecentPayment[]
  latest_receipt: DashboardLatestReceipt | null
  total_paid: number
  upcoming_payments: DashboardUpcomingPayment[]
  expiring_cards: DashboardExpiringCard[]
  action_failed_count: number
  action_rrn_count: number
  action_changes_count: number
  streak: number
}
