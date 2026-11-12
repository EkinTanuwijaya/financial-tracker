import { generateKeyPairSync, createSign } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { AuthService } from "./auth.service";

describe("Google sign-in", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const profile = {
    id: "user",
    email: "user@gmail.com",
    name: "User",
    telegramId: null,
  };
  const users = { findOrCreateGoogleUser: jest.fn() };
  const jwt = { sign: jest.fn().mockReturnValue("app-token") };
  const config = { get: jest.fn().mockReturnValue("web-client-id") };
  const sessions = { create: jest.fn().mockResolvedValue("session-id") };
  const service = new AuthService(
    users as any,
    jwt as any,
    config as any,
    sessions as any,
  );

  function token(
    overrides: Record<string, unknown> = {},
    invalidSignature = false,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({ alg: "RS256", kid: "test-key" })}.${encode({
      iss: "https://accounts.google.com",
      aud: "web-client-id",
      sub: "google-user-id",
      iat: now - 10,
      exp: now + 600,
      email: "user@gmail.com",
      email_verified: true,
      name: "User",
      ...overrides,
    })}`;
    const signature = createSign("RSA-SHA256")
      .update(input)
      .sign(privateKey)
      .toString("base64url");
    return `${input}.${invalidSignature ? "invalid" : signature}`;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOrCreateGoogleUser.mockResolvedValue(profile);
    config.get.mockReturnValue("web-client-id");
    jest
      .spyOn(OAuth2Client.prototype, "getFederatedSignonCertsAsync")
      .mockResolvedValue({
        certs: {
          "test-key": publicKey
            .export({ type: "spki", format: "pem" })
            .toString(),
        },
      } as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it("verifies the signed Google token and issues an app token with only the public profile", async () => {
    await expect(service.loginWithGoogle(token())).resolves.toEqual({
      user: profile,
      token: "app-token",
    });
    expect(users.findOrCreateGoogleUser).toHaveBeenCalledWith({
      googleId: "google-user-id",
      email: profile.email,
      name: "User",
    });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: profile.id,
      sid: "session-id",
    });
  });

  it.each([
    ["wrong audience", { aud: "another-app" }],
    ["wrong issuer", { iss: "https://attacker.example" }],
    ["expired token", { iat: 1, exp: 2 }],
    ["unverified email", { email_verified: false }],
    ["missing email", { email: undefined }],
    ["missing subject", { sub: undefined }],
  ])("rejects %s without accessing an account", async (_label, claims) => {
    await expect(service.loginWithGoogle(token(claims))).rejects.toThrow();
    expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    await expect(service.loginWithGoogle(token({}, true))).rejects.toThrow(
      "Google sign-in failed",
    );
    expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it("fails clearly when Google sign-in has not been configured", async () => {
    config.get.mockReturnValue("");
    await expect(service.loginWithGoogle(token())).rejects.toThrow(
      "not configured",
    );
    expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it.each(["", null, 42, "x".repeat(10001)])(
    "rejects invalid credential input",
    async (credential) => {
      await expect(
        service.loginWithGoogle(credential as string),
      ).rejects.toThrow("Google ID token is required");
    },
  );
});
