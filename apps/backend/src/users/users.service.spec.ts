import { UsersService } from "./users.service";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";

describe("UsersService account defaults", () => {
  it("creates account and user-owned categories together while returning only the public profile", async () => {
    const profile = {
      id: "user",
      email: "user@example.test",
      name: "User",
      telegramId: null,
    };
    const create = jest.fn().mockResolvedValue(profile);
    const service = new UsersService({ user: { create } } as any, {} as any);
    await expect(
      service.create({ email: profile.email, passwordHash: "hashed-password" }),
    ).resolves.toEqual(profile);
    const query = create.mock.calls[0][0];
    expect(query.data.categories.create).toEqual(DEFAULT_CATEGORIES);
    expect(query.data.categories.create).toContainEqual({
      name: "Salary",
      type: "INCOME",
    });
    expect(query.data.passwordHash).toBe("hashed-password");
    expect(query.select).toEqual({
      id: true,
      email: true,
      name: true,
      telegramId: true,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed account/default-category write without returning a partial account", async () => {
    const create = jest
      .fn()
      .mockRejectedValue(new Error("Category write failed"));
    const service = new UsersService({ user: { create } } as any, {} as any);
    await expect(
      service.create({ email: "user@example.test" }),
    ).rejects.toThrow("Category write failed");
  });
});

describe("UsersService Google accounts", () => {
  const profile = {
    id: "user",
    email: "user@gmail.com",
    name: "User",
    telegramId: null,
  };
  const data = { googleId: "google-id", email: profile.email, name: "User" };
  let user: { findUnique: jest.Mock; findFirst: jest.Mock; upsert: jest.Mock };
  let service: UsersService;
  beforeEach(() => {
    user = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn().mockResolvedValue(profile),
    };
    service = new UsersService(
      {
        $transaction: (run: any) => run({ user }),
      } as any,
      {} as any,
    );
  });

  it("uses the stable Google ID even if email changes", async () => {
    user.findUnique.mockResolvedValueOnce(profile);
    await expect(
      service.findOrCreateGoogleUser({ ...data, email: "changed@gmail.com" }),
    ).resolves.toEqual(profile);
    expect(user.findUnique).toHaveBeenCalledTimes(1);
    expect(user.upsert).not.toHaveBeenCalled();
  });

  it("protects existing password accounts from automatic email linking", async () => {
    user.findUnique.mockResolvedValueOnce(null);
    user.findFirst.mockResolvedValueOnce({ ...profile, googleId: null });
    await expect(service.findOrCreateGoogleUser(data)).rejects.toThrow(
      "existing method",
    );
    expect(user.upsert).not.toHaveBeenCalled();
  });

  it("rejects a different Google account with an already used email", async () => {
    user.findUnique.mockResolvedValueOnce(null);
    user.findFirst.mockResolvedValueOnce({
      ...profile,
      googleId: "other-google-id",
    });
    await expect(service.findOrCreateGoogleUser(data)).rejects.toThrow(
      "existing method",
    );
    expect(user.upsert).not.toHaveBeenCalled();
  });

  it("creates a passwordless account with default categories and returns only public fields", async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(service.findOrCreateGoogleUser(data)).resolves.toEqual(
      profile,
    );
    expect(user.upsert).toHaveBeenCalledWith({
      where: { googleId: data.googleId },
      update: {},
      create: {
        googleId: data.googleId,
        email: data.email,
        name: "User",
        categories: { create: DEFAULT_CATEGORIES },
      },
      select: { id: true, email: true, name: true, telegramId: true },
    });
  });
});
