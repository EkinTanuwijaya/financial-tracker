import { NotFoundException } from "@nestjs/common";
import { CreateCategoryDto, UpdateCategoryDto } from "../common/request.dto";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new category" })
  async create(@Body() body: CreateCategoryDto, @Request() req: any) {
    return this.categoriesService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all categories for user" })
  async findAll(@Request() req: any) {
    return this.categoriesService.findAll(req.user.id);
  }

  @Post("seed")
  @ApiOperation({ summary: "Seed default categories" })
  async seedDefaults(@Request() req: any) {
    return this.categoriesService.seedDefaults(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category by ID" })
  async findById(@Param("id") id: string, @Request() req: any) {
    const category = await this.categoriesService.findById(id, req.user.id);
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update category" })
  async update(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, req.user.id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete category" })
  async delete(@Param("id") id: string, @Request() req: any) {
    return this.categoriesService.delete(id, req.user.id);
  }
}
