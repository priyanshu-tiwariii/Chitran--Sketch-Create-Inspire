import dotenv from 'dotenv';
dotenv.config();


import {createServer} from 'http';
import express from 'express';


import cors from 'cors';
import routes from './routes';
import cookieParser from 'cookie-parser';
import { env } from '@repo/backend-common/config';
import compression from 'compression';
import { prisma, redis } from './db';

const app = express();
const server = createServer(app);
app.use(compression());
app.use(cookieParser());






app.use(express.json());
app.use(cors());
app.use("/api/v1",routes);
server.listen(env.HTTP_PORT,() => {
  console.log(`Http-Server is running on port  ${env.HTTP_BASE_URL}`);
});