import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";

@ApiTags("categories")
@ApiBearerAuth()
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new category" })
  async create(
    @Body() body: { name: string; type: string },
    @Query("userId") userId: string,
  ) {
    return this.categoriesService.create(userId, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all categories for user" })
  async findAll(@Query("userId") userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @Post("seed")
  @ApiOperation({ summary: "Seed default categories" })
  async seedDefaults(@Query("userId") userId: string) {
    return this.categoriesService.seedDefaults(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category by ID" })
  async findById(@Param("id") id: string, @Query("userId") userId: string) {
    return this.categoriesService.findById(id, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update category" })
  async update(
    @Param("id") id: string,
    @Query("userId") userId: string,
    @Body() body: Partial<{ name: string; type: string }>,
  ) {
    return this.categoriesService.update(id, userId, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete category" })
  async delete(@Param("id") id: string, @Query("userId") userId: string) {
    return this.categoriesService.delete(id, userId);
  }
}
