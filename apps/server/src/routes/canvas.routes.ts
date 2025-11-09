import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middlewares";
import { syncStrokes, getStroke } from "../controllers/canvas.controller"; 

const canvasRoutes : Router = Router();
canvasRoutes.post("/:fileId", verifyToken, syncStrokes); 
canvasRoutes.get("/:fileId", verifyToken, getStroke);

export default canvasRoutes;