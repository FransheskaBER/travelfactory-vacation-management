import * as bcrypt from "bcrypt";
import { cliDataSource } from "./dataSource";
import { User, UserRole } from "../entities/User";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../entities/VacationRequest";

// Cost factor 10 per D7 — fast enough for a local seed, strong enough that
// the stored hashes are realistic.
const BCRYPT_COST = 10;

// One shared demo password, documented in the README's demo-credentials table.
const DEMO_PASSWORD = "Demo1234!";

// Dates are computed relative to "today" so the demo data never goes stale:
// pending requests stay in the future (Rule 4), and past rows only ever
// appear as already-approved history. UTC to match A5's reference clock.
const daysFromToday = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const seed = async (): Promise<void> => {
  const ds = await cliDataSource;
  await ds.initialize();
  try {
    // Wipe-and-reseed: deterministic state on every run. Requests go first —
    // both of their FKs point at users.
    await ds.createQueryBuilder().delete().from(VacationRequest).execute();
    await ds.createQueryBuilder().delete().from(User).execute();

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    const users = ds.getRepository(User);

    const alice = await users.save(
      users.create({
        name: "Alice Martin",
        email: "alice.requester@demo.test",
        password: passwordHash,
        role: UserRole.Requester,
      })
    );
    const bob = await users.save(
      users.create({
        name: "Bob Chen",
        email: "bob.requester@demo.test",
        password: passwordHash,
        role: UserRole.Requester,
      })
    );
    const carla = await users.save(
      users.create({
        name: "Carla Dupont",
        email: "carla.validator@demo.test",
        password: passwordHash,
        role: UserRole.Validator,
      })
    );

    // Every status represented, both requesters populated, no per-user
    // overlap among Pending/Approved rows (Rule 2), rejection carries a
    // comment (Rule 5) — seeded rows are indistinguishable from rows the
    // API could have produced.
    const requests = ds.getRepository(VacationRequest);
    await requests.save([
      requests.create({
        userId: alice.id,
        startDate: daysFromToday(7),
        endDate: daysFromToday(11),
        reason: "Family visit",
        status: VacationRequestStatus.Approved,
        reviewedBy: carla.id,
      }),
      requests.create({
        userId: alice.id,
        startDate: daysFromToday(21),
        endDate: daysFromToday(25),
        reason: "Autumn break",
        status: VacationRequestStatus.Pending,
      }),
      requests.create({
        userId: alice.id,
        startDate: daysFromToday(14),
        endDate: daysFromToday(16),
        reason: "Moving apartments",
        status: VacationRequestStatus.Rejected,
        reviewedBy: carla.id,
        comments: "Team is understaffed that week — please pick other dates.",
      }),
      requests.create({
        userId: bob.id,
        startDate: daysFromToday(14),
        endDate: daysFromToday(18),
        reason: "Hiking trip",
        status: VacationRequestStatus.Pending,
      }),
      requests.create({
        userId: bob.id,
        startDate: daysFromToday(-30),
        endDate: daysFromToday(-26),
        reason: "Spring holiday",
        status: VacationRequestStatus.Approved,
        reviewedBy: carla.id,
      }),
    ]);

    console.log(
      `[seed] done — 3 users (2 Requesters, 1 Validator), 5 requests. ` +
        `Login: *.demo.test / ${DEMO_PASSWORD}`
    );
  } finally {
    await ds.destroy();
  }
};

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exitCode = 1;
});
