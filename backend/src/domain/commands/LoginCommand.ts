import * as bcrypt from "bcrypt";
import { UnauthorizedError } from "../../errors/DomainError";
import { User } from "../../entities/User";
import { signJwt } from "../../auth/jwt";

// Injected as a typed function, not a repository port — no business-concept
// query on vacation requests here (ADR 0001), and Phase 5 unit tests can
// stub it without a DB (spec 4.2 §4).
export type FindUserByEmail = (email: string) => Promise<User | null>;

export interface LoginInput {
  email: string;
  password: string;
}

// Pre-generated bcrypt hash at D7's cost factor (10) — must match the seed
// hashes' cost, because bcrypt's runtime comes from the cost factor baked
// into the hash it compares against; a cheaper dummy would reopen the
// timing gap this exists to close (spec 4.2 §8 Q8). Module-level so each
// request pays only a compare, never a hash generation.
const DUMMY_HASH =
  "$2b$10$UihzsukmGFcYnU5uUNMwmOcMp3DHUjMXLmez26aNBNfWLA3t1GaAO";

const invalidCredentials = (): UnauthorizedError =>
  new UnauthorizedError("INVALID_CREDENTIALS", "Invalid email or password");

export class LoginCommand {
  constructor(private readonly deps: { findUserByEmail: FindUserByEmail }) {}

  async execute(input: LoginInput): Promise<{ token: string }> {
    const user = await this.deps.findUserByEmail(input.email);

    if (!user) {
      // Unknown email and wrong password must be indistinguishable by
      // response time as well as by body — both paths cost one compare.
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw invalidCredentials();
    }

    const matches = await bcrypt.compare(input.password, user.password);
    if (!matches) throw invalidCredentials();

    return { token: signJwt({ userId: user.id, role: user.role }) };
  }
}
