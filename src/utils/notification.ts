import prisma from "../config/prisma.js";
import { io } from "../app.js";

export const emitNotification = async (notificationId: number) => {
  const notification = await prisma.notifications.findUnique({
    where: { id: notificationId },
    include: {
      actor: { select: { id: true, user_name: true, profile_url: true } },
    },
  });
  if (!notification) return;

  const unreadCount = await prisma.notifications.count({
    where: { recipient_id: notification.recipient_id, is_read: false },
  });

  io.to(`user_${notification.recipient_id}`).emit(
    "notification_received",
    notification
  );
  io.to(`user_${notification.recipient_id}`).emit(
    "notification_count",
    unreadCount
  );
};

export const emitNotificationRemoved = async (
  notificationId: number,
  recipientId: number
) => {
  const unreadCount = await prisma.notifications.count({
    where: { recipient_id: recipientId, is_read: false },
  });

  io.to(`user_${recipientId}`).emit("notification_removed", {
    notificationId,
    recipientId,
  });
  io.to(`user_${recipientId}`).emit("notification_count", unreadCount);
};
