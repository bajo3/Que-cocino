import { describe, expect, it } from "vitest";
import { getAuthenticatedUser } from "./session-user";

describe("getAuthenticatedUser", () => {
  it("rejects missing sessions and sessions without a user id", () => {
    expect(getAuthenticatedUser(null)).toBeNull();
    expect(getAuthenticatedUser({ user: null })).toBeNull();
    expect(getAuthenticatedUser({ user: { name: "Sin id" } })).toBeNull();
  });

  it("returns a user whose id is guaranteed", () => {
    expect(getAuthenticatedUser({ user: { id: "user-1", name: "Felipe" } })).toEqual({
      id: "user-1",
      name: "Felipe",
    });
  });
});
