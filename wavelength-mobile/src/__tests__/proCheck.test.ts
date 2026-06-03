import { isProUser } from "../utils/proCheck";
import type { User } from "../api/auth";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "abc",
    email: "test@example.com",
    name: "Test",
    interests: [],
    subscription_tier: "free",
    subscription_expires_at: null,
    email_verified: true,
    ...overrides,
  } as User;
}

describe("isProUser", () => {
  test("returns false for null user", () => {
    expect(isProUser(null)).toBe(false);
  });

  test("returns false for free tier", () => {
    expect(isProUser(makeUser({ subscription_tier: "free" }))).toBe(false);
  });

  test("returns true for lifetime tier", () => {
    expect(isProUser(makeUser({ subscription_tier: "lifetime" }))).toBe(true);
  });

  test("returns true for pro with no expiry", () => {
    expect(isProUser(makeUser({ subscription_tier: "pro", subscription_expires_at: null }))).toBe(true);
  });

  test("returns true for pro with future expiry", () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // +1 day
    expect(isProUser(makeUser({ subscription_tier: "pro", subscription_expires_at: future }))).toBe(true);
  });

  test("returns false for pro with past expiry", () => {
    const past = new Date(Date.now() - 86400000).toISOString(); // -1 day
    expect(isProUser(makeUser({ subscription_tier: "pro", subscription_expires_at: past }))).toBe(false);
  });

  test("returns true for active trial", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isProUser(makeUser({ subscription_tier: "trial", subscription_expires_at: future }))).toBe(true);
  });

  test("returns false for expired trial", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isProUser(makeUser({ subscription_tier: "trial", subscription_expires_at: past }))).toBe(false);
  });
});
