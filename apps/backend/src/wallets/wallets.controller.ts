import { NotFoundException } from "@nestjs/common";
import { CreateWalletDto, UpdateWalletDto } from "../common/request.dto";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { WalletsService } from "./wallets.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("wallets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new wallet" })
  async create(
    @Body()
    body: CreateWalletDto,
    @Request() req: any,
  ) {
    return this.walletsService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all wallets for user" })
  async findAll(@Request() req: any) {
    return this.walletsService.findAll(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get wallet by ID" })
  async findById(@Param("id") id: string, @Request() req: any) {
    const wallet = await this.walletsService.findById(id, req.user.id);
    if (!wallet) throw new NotFoundException("Wallet not found");
    return wallet;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update wallet" })
  async update(
    @Param("id") id: string,
    @Request() req: any,
    @Body()
    body: UpdateWalletDto,
  ) {
    return this.walletsService.update(id, req.user.id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete wallet" })
  async delete(@Param("id") id: string, @Request() req: any) {
    return this.walletsService.delete(id, req.user.id);
  }
}
