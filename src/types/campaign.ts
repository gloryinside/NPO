export type Campaign = {
  id: string;
  org_id: string;
  title: string;
  slug: string;
  description: string | null;
  goal_amount: number | null;
  status: "draft" | "active" | "closed" | "archived";
  started_at: string | null;
  ended_at: string | null;
  thumbnail_url: string | null;
  donation_type: "regular" | "onetime" | "both";
  preset_amounts: number[] | null;
  pay_methods: string[] | null;
  ga_tracking_id: string | null;
  meta_pixel_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  page_content: Record<string, unknown> | null;
  published_content: Record<string, unknown> | null;
  form_settings: Record<string, unknown> | null;
  /** G-D173 1건당 금액 (KRW). 예: 3000 = 한 끼 */
  impact_unit_amount: number | null;
  /** G-D173 단위 라벨. 예: "끼", "회 방문" */
  impact_unit_label: string | null;
  created_at: string;
  updated_at: string;
};
