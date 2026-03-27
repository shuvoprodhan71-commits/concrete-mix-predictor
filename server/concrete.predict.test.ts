import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("concrete.predict", () => {
  it("returns 7 components for C30 at 28 days", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.concrete.predict({ strength: 30, age: 28 });

    expect(result.components).toHaveLength(7);
    expect(result.target).toBe(30);
    expect(result.verified).toBeGreaterThan(0);
    expect(result.error).toBeGreaterThanOrEqual(0);
    expect(result.errorPct).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("all components have valid status values", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.concrete.predict({ strength: 40, age: 28 });

    for (const c of result.components) {
      expect(["OK", "Warning"]).toContain(c.status);
      expect(c.value).toBeGreaterThan(0);
      expect(c.min).toBeGreaterThanOrEqual(0);
      expect(c.max).toBeGreaterThan(c.min);
    }
  }, 60_000);

  it("rejects strength below 2 MPa", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.concrete.predict({ strength: 1, age: 28 })
    ).rejects.toThrow();
  });

  it("rejects strength above 83 MPa", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.concrete.predict({ strength: 90, age: 28 })
    ).rejects.toThrow();
  });

  it("rejects invalid age of 0", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.concrete.predict({ strength: 30, age: 0 })
    ).rejects.toThrow();
  });

  it("returns meta with dataset and algorithm info", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.concrete.predict({ strength: 50, age: 28 });

    expect(result.meta.dataset).toContain("Yeh");
    expect(result.meta.algorithm).toContain("kNN");
    expect(result.meta.strengthMin).toBeGreaterThan(0);
    expect(result.meta.strengthMax).toBeGreaterThan(50);
  }, 60_000);
});
