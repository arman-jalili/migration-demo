// Baseline tests — the findByStatus test is added by the agent during the demo.
import { CustomerRepo } from "./customers.js";

describe("CustomerRepo", () => {
  const repo = new CustomerRepo();

  it("lists seeded customers", async () => {
    const customers = await repo.list();
    expect(customers.length).toBeGreaterThanOrEqual(3);
  });

  it("finds a customer by id", async () => {
    const c = await repo.findById(1);
    expect(c).not.toBeNull();
    expect(c!.name.length).toBeGreaterThan(0);
  });

  it("returns customers by status", async () => {
    const customers = await repo.findByStatus("active");
    expect(customers.length).toBeGreaterThanOrEqual(3);
    expect(customers.every((c) => c.status === "active")).toBe(true);
  });
});
