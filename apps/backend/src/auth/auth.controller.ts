import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register new user" })
  async register(
    @Body() body: { email: string; password: string; name?: string },
  ) {
    return this.authService.register(body);
  }

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user" })
  async me(@Request() req: any) {
    return this.authService.validateUser(req.user.id);
  }
}
