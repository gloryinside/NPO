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
  created_at: string;
  updated_at: string;
};
