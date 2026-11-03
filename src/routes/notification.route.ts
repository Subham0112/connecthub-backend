import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  getNotifications,
  markNotificationsRead,
} from "../controllers/notification.controller.js";

export const notificationRouter = Router();

notificationRouter.get("/notifications", verifyToken, getNotifications);
notificationRouter.patch(
  "/notifications/read-all",
  verifyToken,
  markNotificationsRead
);
