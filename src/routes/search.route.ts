import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { search } from "../controllers/search.controller.js";

export const searchRouter = Router();

searchRouter.get("/search", verifyToken, search);
