import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(data: { email: string; password: string; name?: string }) {
    if (await this.usersService.emailExists(data.email)) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      passwordHash,
      name: data.name,
    });

    const token = this.generateToken(user.id);
    return { user, token };
  }

  async login(data: { email: string; password: string }) {
    // The only place a password hash is read, and it stays inside this method.
    const credentials = await this.usersService.findCredentialsByEmail(data.email);
    if (!credentials?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isValid = await bcrypt.compare(data.password, credentials.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Return the public profile (includes telegramId), not the
    // credentials row, so the client sees the current Telegram link state.
    const user = await this.usersService.findById(credentials.id);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = this.generateToken(user.id);
    return { user, token };
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }

  private generateToken(userId: string) {
    return this.jwtService.sign({ sub: userId });
  }
}
