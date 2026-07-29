import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { InputParserFn, HandlerFn } from "./types";
import { errorResponse } from "../errors/toErrorResponse";
import { getDataSource } from "../db/dataSource";
import { User } from "../entities/User";
import {
  FindUserByEmail,
  LoginCommand,
  LoginInput,
} from "../domain/commands/LoginCommand";
import { commandBus } from "../domain/bus/CommandBus";

// --- POST /login ---

// Shape-only (ADR 0001): presence and type, no format rules — 4.7
// revisited and kept it that way (wording pass only, spec 4.7 §4).
export const parseLoginInput: InputParserFn = (event: CommonEvent) => {
  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "");
  } catch {
    return errorResponse(400, "INVALID_INPUT", "Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null) {
    return errorResponse(400, "INVALID_INPUT", "Body must be a JSON object");
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || email.length === 0) {
    return errorResponse(400, "INVALID_INPUT", "email must be a non-empty string");
  }
  if (typeof password !== "string" || password.length === 0) {
    return errorResponse(400, "INVALID_INPUT", "password must be a non-empty string");
  }
  return { email, password } as LoginInput;
};

// The QueryBuilder's addSelect is the explicit opt-in to the password hash
// that User's select:false otherwise hides (spec 4.1 §8 Q3).
const findUserByEmail: FindUserByEmail = async (email) => {
  const ds = await getDataSource();
  return ds
    .getRepository(User)
    .createQueryBuilder("user")
    .addSelect("user.password")
    .where("user.email = :email", { email })
    .getOne();
};

export const login: HandlerFn = async (input: LoginInput) =>
  commandBus.execute(new LoginCommand({ findUserByEmail }), input);
