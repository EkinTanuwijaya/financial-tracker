import { ValidationPipe } from "@nestjs/common";
import {
  CreateTransactionDto,
  RegisterDto,
  ProfileDto,
  TransactionQueryDto,
  UpdateWalletDto,
} from "./request.dto";
import { jakartaDate } from "./calendar-date";

describe("API request boundaries", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const parse = (value: unknown, metatype: any) =>
    pipe.transform(value, { type: "body", metatype });
  it("rejects overposting privileged profile fields", async () => {
    for (const field of ["passwordHash", "googleId", "telegramId", "id"]) {
      await expect(
        parse({ name: "User", [field]: "attacker" }, ProfileDto),
      ).rejects.toThrow();
    }
  });
  it("normalizes email and rejects short or bcrypt-truncated passwords", async () => {
    expect(
      await parse(
        { email: " User@Example.com ", password: "safe-password" },
        RegisterDto,
      ),
    ).toMatchObject({ email: "user@example.com" });
    await expect(
      parse({ email: "user@example.com", password: "short" }, RegisterDto),
    ).rejects.toThrow();
    await expect(
      parse(
        { email: "user@example.com", password: "é".repeat(37) },
        RegisterDto,
      ),
    ).rejects.toThrow();
  });
  it("accepts date-only dates and CUIDs but rejects malformed money and dates", async () => {
    const data = {
      walletId: "cmwallet",
      categoryId: "cmcategory",
      amount: 10,
      transactionDate: "2026-11-07",
    };
    await expect(parse(data, CreateTransactionDto)).resolves.toMatchObject(
      data,
    );
    for (const amount of [0, -10, 1e-100, "10", null])
      await expect(
        parse({ ...data, amount }, CreateTransactionDto),
      ).rejects.toThrow();
    await expect(
      parse({ ...data, transactionDate: "2026-02-31" }, CreateTransactionDto),
    ).rejects.toThrow();
    await expect(parse({ balance: null }, UpdateWalletDto)).rejects.toThrow();
  });
  it("parses query numbers without allowing negative or unbounded pagination", async () => {
    await expect(
      parse({ limit: "51", offset: "50" }, TransactionQueryDto),
    ).resolves.toMatchObject({ limit: 51, offset: 50 });
    for (const query of [
      { limit: "-1" },
      { limit: "1000000" },
      { offset: "bad" },
    ])
      await expect(parse(query, TransactionQueryDto)).rejects.toThrow();
  });
  it("uses Jakarta's calendar date around UTC midnight", () => {
    expect(jakartaDate(new Date("2026-11-06T18:00:00Z"))).toBe("2026-11-07");
  });
});
