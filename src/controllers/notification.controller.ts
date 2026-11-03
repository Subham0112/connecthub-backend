import type { Request, Response } from "express";
import prisma from "../config/prisma.js";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.userId);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where: { recipient_id: userId },
        include: {
          actor: {
            select: { id: true, user_name: true, profile_url: true },
          },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: 50,
      }),
      prisma.notifications.count({
        where: { recipient_id: userId, is_read: false },
      }),
    ]);

    return res.status(200).json({ notifications, unreadCount });
  } catch (err) {
    console.error("Error fetching notifications", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.userId);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const result = await prisma.notifications.updateMany({
      where: { recipient_id: userId, is_read: false },
      data: { is_read: true },
    });

    return res.status(200).json({
      message: "Notifications marked as read",
      updated: result.count,
    });
  } catch (err) {
    console.error("Error marking notifications read", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
