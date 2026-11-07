import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/prisma/prisma-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new PrismaExceptionFilter());
  const dashboardOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim());
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      ((request.headers.origin &&
        !dashboardOrigins.includes(request.headers.origin) &&
        request.headers.origin !== `${request.protocol}://${request.get("host")}`) ||
        (request.headers.cookie?.includes("finance_session=") &&
          !request.headers.origin))
    ) {
      response
        .status(403)
        .json({ statusCode: 403, message: "Request origin is not allowed" });
      return;
    }
    next();
  });
  app.enableCors({
    origin: dashboardOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Finance Tracker API")
    .setDescription("Personal Finance Tracker API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
