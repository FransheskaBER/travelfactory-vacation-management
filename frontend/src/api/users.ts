import { apiClient } from "./client";
import type { UserSummary } from "../types";

/** GET /users — validator-only, id + name only (A10), name ASC from the
 * server (spec 4.6 §5). Feeds the dashboard's name map and the user
 * filter combobox (spec 4.10 §4). */
export const listUsers = async (): Promise<UserSummary[]> => {
  const response = await apiClient.get<UserSummary[]>("/users");
  return response.data;
};
