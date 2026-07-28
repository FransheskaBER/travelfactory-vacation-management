import { HandlerFn } from "./types";
import { getDataSource } from "../db/dataSource";
import { requireRole } from "../auth/requireRole";
import { User, UserRole } from "../entities/User";

// --- GET /users ---

// Validator-only list for the dashboard filter combobox (A10). The select
// is the privacy boundary: id + name only — no email, role, or credentials
// (spec 4.6 §5); name ASC for deterministic combobox order (§8 Q2).
export const listUsers: HandlerFn = requireRole(UserRole.Validator, async () => {
  const ds = await getDataSource();
  return ds.getRepository(User).find({
    select: { id: true, name: true },
    order: { name: "ASC" },
  });
});
