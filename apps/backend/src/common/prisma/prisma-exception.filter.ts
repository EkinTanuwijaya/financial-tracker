import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const status =
      error.code === "P2025"
        ? 404
        : ["P2002", "P2003", "P2034"].includes(error.code)
          ? 409
          : 500;
    const message =
      error.code === "P2025"
        ? "Record not found"
        : error.code === "P2002"
          ? "A record with these details already exists"
          : error.code === "P2003"
            ? "This record is used by other records and cannot be deleted"
            : error.code === "P2034"
              ? "Another update changed this record. Please try again."
              : "Database operation failed";
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({ statusCode: status, message });
  }
}
