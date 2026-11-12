import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { DEFAULT_CATEGORIES } from "./default-categories";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async findByName(userId: string, name: string) {
    return this.prisma.category.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" } },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.category.findFirst({
      where: { id, userId },
    });
  }

  async create(userId: string, data: { name: string; type: string }) {
    return this.prisma.category.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{ name: string; type: string }>,
  ) {
    return this.prisma.serializable(async (tx) => {
      const category = await tx.category.findFirst({ where: { id, userId } });
      if (!category) throw new NotFoundException("Category not found");
      if (
        data.type &&
        data.type !== category.type &&
        (await tx.transaction.count({ where: { categoryId: id } }))
      ) {
        throw new ConflictException(
          "Cannot change the type of a category with transactions. Create a new category instead.",
        );
      }
      return tx.category.update({
        where: { id, userId },
        data: { name: data.name, type: data.type },
      });
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.category.delete({
      where: { id, userId },
    });
  }

  async seedDefaults(userId: string) {
    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
      skipDuplicates: true,
    });

    return this.findAll(userId);
  }
}
