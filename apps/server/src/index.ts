import dotenv from 'dotenv';
dotenv.config();


import {createServer} from 'http';
import express, { Request, Response, NextFunction } from 'express';


import cors from 'cors';
import routes from './routes';
import cookieParser from 'cookie-parser';
import { env } from '@repo/backend-common/config';
import compression from 'compression';
import { prisma, redis } from './db';
import apiError from './helpers/apiError';

const app = express();
const server = createServer(app);
app.use(compression());
app.use(cookieParser());






app.use(express.json());
app.use(cors());
app.use("/api/v1",routes);

// Global error handler — must be registered AFTER all routes.
// Express detects error-handling middleware by the 4-parameter signature.
// Defined as a named function (not an arrow) so TypeScript resolves the correct overload.
function globalErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof apiError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      errors: err.errors ?? null,
    });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
}
app.use(globalErrorHandler);

server.listen(env.HTTP_PORT,() => {
  console.log(`Http-Server is running on port  ${env.HTTP_BASE_URL}`);
});