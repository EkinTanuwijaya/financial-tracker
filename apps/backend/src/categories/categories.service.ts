import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

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
    return this.prisma.category.update({
      where: { id, userId },
      data,
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.category.delete({
      where: { id, userId },
    });
  }

  async seedDefaults(userId: string) {
    const defaults = [
      { name: "Food", type: "EXPENSE" },
      { name: "Transport", type: "EXPENSE" },
      { name: "Shopping", type: "EXPENSE" },
      { name: "Entertainment", type: "EXPENSE" },
      { name: "Bills", type: "EXPENSE" },
      { name: "Health", type: "EXPENSE" },
      { name: "Salary", type: "INCOME" },
      { name: "Other", type: "EXPENSE" },
    ];

    for (const cat of defaults) {
      await this.prisma.category.upsert({
        where: { userId_name: { userId, name: cat.name } },
        update: {},
        create: { ...cat, userId },
      });
    }

    return this.findAll(userId);
  }
}
