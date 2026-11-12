import Redis from "ioredis";
import { TelegramLinkService } from "./telegram-link.service";
jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({
      set: jest.fn(),
      getdel: jest.fn(),
      disconnect: jest.fn(),
    })),
}));
describe("Telegram pairing proof", () => {
  it("issues random single-use codes with ten-minute expiry and rejects raw account IDs", async () => {
    const service = new TelegramLinkService({
      get: () => "redis://localhost",
    } as any);
    const redis = (Redis as unknown as jest.Mock).mock.results[0].value;
    const code = await service.issue("123456789");
    expect(code).toMatch(/^[a-f0-9]{32}$/);
    expect(redis.set).toHaveBeenCalledWith(
      `telegram-link:${code}`,
      "123456789",
      "EX",
      600,
    );
    await expect(service.consume("123456789")).rejects.toThrow("pairing code");
    expect(redis.getdel).not.toHaveBeenCalled();
    redis.getdel.mockResolvedValueOnce("123456789").mockResolvedValueOnce(null);
    await expect(service.consume(code)).resolves.toBe("123456789");
    await expect(service.consume(code)).rejects.toThrow("expired");
  });
});
