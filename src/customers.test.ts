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
});
