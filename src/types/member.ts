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
  /** 암호화된 주민등록번호 (pgp_sym_encrypt). 평문은 서버에서만 복호화. */
  id_number_encrypted?: string | null;
  created_at: string;
  updated_at: string;
};
