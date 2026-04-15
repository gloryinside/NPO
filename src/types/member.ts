export type MemberStatus = "active" | "inactive" | "deceased";
export type MemberType = "individual" | "corporate";

export type Member = {
  id: string;
  org_id: string;
  member_code: string;
  supabase_uid: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  status: MemberStatus;
  member_type: MemberType;
  join_path: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};
