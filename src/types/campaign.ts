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
  created_at: string;
  updated_at: string;
};
