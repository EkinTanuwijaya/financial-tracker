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
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      passwordHash,
      name: data.name,
    });

    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async verifyCredentials(data: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(data.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  async login(data: { email: string; password: string }) {
    const user = await this.verifyCredentials(data);
    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.sanitizeUser(user);
  }

  private generateToken(userId: string) {
    return this.jwtService.sign({ sub: userId });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...result } = user;
    return result;
  }
}
