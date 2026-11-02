import { UsersService } from "./users.service";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";

describe("UsersService account defaults", () => {
  it("creates account and user-owned categories together while returning only the public profile", async () => {
    const profile = { id: "user", email: "user@example.test", name: "User", telegramId: null };
    const create = jest.fn().mockResolvedValue(profile);
    const service = new UsersService({ user: { create } } as any);
    await expect(service.create({ email: profile.email, passwordHash: "hashed-password" })).resolves.toEqual(profile);
    const query = create.mock.calls[0][0];
    expect(query.data.categories.create).toEqual(DEFAULT_CATEGORIES);
    expect(query.data.categories.create).toContainEqual({ name: "Salary", type: "INCOME" });
    expect(query.data.passwordHash).toBe("hashed-password");
    expect(query.select).toEqual({ id: true, email: true, name: true, telegramId: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed account/default-category write without returning a partial account", async () => {
    const create = jest.fn().mockRejectedValue(new Error("Category write failed"));
    const service = new UsersService({ user: { create } } as any);
    await expect(service.create({ email: "user@example.test" })).rejects.toThrow("Category write failed");
  });
});
