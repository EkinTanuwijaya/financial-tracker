import Redis from "ioredis";
import {
  SessionService,
  SESSION_IDLE_SECONDS,
  sessionToken,
} from "./session.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue("OK"),
    get: jest.fn(),
    expire: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn(),
  })),
}));

describe("Cookie sessions", () => {
  let sessions: SessionService;
  let redis: any;
  const config = {
    getOrThrow: () => "test-secret",
    get: (key: string) => (key === "NODE_ENV" ? "production" : "test-secret"),
  };
  beforeEach(() => {
    sessions = new SessionService(config as any);
    redis = (Redis as unknown as jest.Mock).mock.results.at(-1)!.value;
  });

  it("creates a unique session with a two-hour server TTL", async () => {
    const id = await sessions.create("user");
    expect(redis.set).toHaveBeenCalledWith(`session:${id}`, "user", "EX", 7200);
    expect(SESSION_IDLE_SECONDS).toBe(7200);
    expect(await sessions.create("user")).not.toBe(id);
  });

  it("rejects missing, expired and mismatched sessions", async () => {
    redis.get.mockResolvedValue(null);
    await expect(sessions.validate("expired", "user")).rejects.toThrow(
      "Session expired",
    );
    await expect(sessions.validate("", "user")).rejects.toThrow(
      "Session expired",
    );
    redis.get.mockResolvedValue("another-user");
    await expect(sessions.validate("id", "user")).rejects.toThrow(
      "Session expired",
    );
    redis.get.mockResolvedValue("user");
    await expect(sessions.validate("id", "user")).resolves.toBeUndefined();
  });

  it("renews live sessions atomically but cannot revive an expired session", async () => {
    redis.expire.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await sessions.renew("id");
    expect(redis.expire).toHaveBeenCalledWith("session:id", 7200, "XX");
    await expect(sessions.renew("id")).rejects.toThrow("Session expired");
  });

  it("revokes the server session on logout", async () => {
    await sessions.revoke("id");
    expect(redis.del).toHaveBeenCalledWith("session:id");
  });

  it("sets HttpOnly, Secure, SameSite cookies with two-hour expiry and clears the same path", () => {
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      setHeader: jest.fn(),
    };
    sessions.setCookie(response as any, "signed-token");
    expect(response.cookie).toHaveBeenCalledWith(
      "finance_session",
      "signed-token",
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api",
        maxAge: 7200000,
      },
    );
    sessions.clearCookie(response as any);
    expect(response.clearCookie).toHaveBeenCalledWith("finance_session", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api",
    });
    expect(
      sessionToken({
        headers: { cookie: "other=1; finance_session=signed-token; more=2" },
      } as any),
    ).toBe("signed-token");
    expect(sessionToken({ headers: {} } as any)).toBeNull();
  });

  it("requires a live session before a valid JWT can access user data", async () => {
    const auth = { validateUser: jest.fn().mockResolvedValue({ id: "user" }) };
    const strategy = new JwtStrategy(config as any, auth as any, sessions);
    redis.get.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: "user", sid: "expired" }),
    ).rejects.toThrow("Session expired");
    expect(auth.validateUser).not.toHaveBeenCalled();
    redis.get.mockResolvedValue("user");
    await expect(
      strategy.validate({ sub: "user", sid: "live" }),
    ).resolves.toEqual({ id: "user", sessionId: "live" });
  });
});
