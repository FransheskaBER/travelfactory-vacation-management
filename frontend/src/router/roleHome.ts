import type { Role } from "../types";

const HOMES: Record<Role, string> = {
  Requester: "/my-requests",
  Validator: "/dashboard",
};

/** The single source for every "land on your own home" redirect (spec 4.8 §8 Q3). */
export const roleHome = (role: Role): string => HOMES[role];
