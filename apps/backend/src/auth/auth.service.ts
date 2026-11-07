import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessions: SessionService,
  ) {}

  async loginWithGoogle(credential: string) {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }
    if (
      typeof credential !== "string" ||
      !credential ||
      credential.length > 10000
    ) {
      throw new BadRequestException("A Google ID token is required");
    }

    const payload = await this.googleClient
      .verifyIdToken({ idToken: credential, audience: clientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => {
        throw new UnauthorizedException(
          "Google sign-in failed. Please try again.",
        );
      });

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException(
        "Google account must have a verified email",
      );
    }

    const user = await this.usersService.findOrCreateGoogleUser({
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
    });
    return { user, token: await this.generateToken(user.id) };
  }

  async register(data: { email: string; password: string; name?: string }) {
    data.email = data.email.trim().toLowerCase();
    if (await this.usersService.emailExists(data.email)) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      passwordHash,
      name: data.name,
    });

    const token = await this.generateToken(user.id);
    return { user, token };
  }

  async login(data: { email: string; password: string }) {
    // The only place a password hash is read, and it stays inside this method.
    const credentials = await this.usersService.findCredentialsByEmail(
      data.email,
    );
    if (!credentials?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isValid = await bcrypt.compare(
      data.password,
      credentials.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Return the public profile (includes telegramId), not the
    // credentials row, so the client sees the current Telegram link state.
    const user = await this.usersService.findById(credentials.id);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = await this.generateToken(user.id);
    return { user, token };
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }

  private async generateToken(userId: string) {
    const sid = await this.sessions.create(userId);
    return this.jwtService.sign({ sub: userId, sid });
  }
}
