import { Transform, Type } from "class-transformer";
import {
  IsByteLength,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { PartialType } from "@nestjs/swagger";

const optional = () => ValidateIf((_object, value) => value !== undefined);
const email = () =>
  Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  );

export class LoginDto {
  @email() @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @MinLength(8) @IsByteLength(1, 72) password!: string;
  @optional() @IsString() @MaxLength(100) name?: string;
}
export class ProfileDto {
  @optional() @IsString() @MaxLength(100) name?: string;
  @optional() @email() @IsEmail() @MaxLength(254) email?: string;
}
export class TelegramLinkDto {
  @IsString() @MaxLength(100) code!: string;
}
export class CreateWalletDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
  @IsIn(["CASH", "BANK", "EWALLET", "CREDIT_CARD", "OTHER"]) type!: string;
  @optional() @IsIn(["IDR"]) currency?: string;
  @optional()
  @IsNumber()
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  balance?: number;
}
export class UpdateWalletDto extends PartialType(CreateWalletDto, {
  skipNullProperties: false,
}) {}
export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
  @IsIn(["INCOME", "EXPENSE"]) type!: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto, {
  skipNullProperties: false,
}) {}
export class CreateTransactionDto {
  @IsString() @IsNotEmpty() walletId!: string;
  @IsString() @IsNotEmpty() categoryId!: string;
  @IsNumber() @Min(0.01) @Max(Number.MAX_SAFE_INTEGER) amount!: number;
  @optional() @IsIn(["IDR"]) currency?: string;
  @optional() @IsString() @MaxLength(2000) description?: string;
  @IsDateString({ strict: true }) transactionDate!: string;
  @optional() @IsIn(["TEXT", "RECEIPT", "MANUAL"]) source?: string;
}
export class UpdateTransactionDto extends PartialType(CreateTransactionDto, {
  skipNullProperties: false,
}) {}
export class TransactionQueryDto {
  @optional() @IsString() walletId?: string;
  @optional() @IsString() categoryId?: string;
  @optional() @IsDateString({ strict: true }) startDate?: string;
  @optional() @IsDateString({ strict: true }) endDate?: string;
  @optional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @optional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
export class CreateReceiptDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) fileUrl!: string;
}
export class ReceiptStatusDto {
  @IsIn([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "WAITING_CONFIRMATION",
  ])
  status!: string;
  @optional() @IsObject() extractedData?: Record<string, unknown>;
  @optional() @IsString() rawText?: string;
}
export class ReceiptLinkDto {
  @IsString() @IsNotEmpty() transactionId!: string;
}
