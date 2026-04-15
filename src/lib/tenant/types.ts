export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "trial";
};
