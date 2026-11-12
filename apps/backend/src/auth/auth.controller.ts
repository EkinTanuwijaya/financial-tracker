import { LoginDto, RegisterDto } from "../common/request.dto";
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { SessionService, sessionToken } from "./session.service";
import { ExtractJwt } from "passport-jwt";

class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  credential!: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register new user" })
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(body);
    this.sessions.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    this.sessions.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post("google")
  @ApiOperation({ summary: "Sign in or create an account with Google" })
  async google(
    @Body() body: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithGoogle(body.credential);
    this.sessions.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post("activity")
  @UseGuards(JwtAuthGuard)
  async activity(
    @Request() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.renew(request.user.sessionId);
    const token =
      sessionToken(request) ||
      ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    this.sessions.setCookie(response, token!);
    return { ok: true };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @Request() request: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revoke(request.user.sessionId);
    this.sessions.clearCookie(response);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user" })
  async me(
    @Request() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    const { sessionId, ...profile } = req.user;
    return profile;
  }
}
