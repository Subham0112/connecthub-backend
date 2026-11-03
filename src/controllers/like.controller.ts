import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import {
  emitNotification,
  emitNotificationRemoved,
} from "../utils/notification.js";

export const toggleLike = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const userId = Number(req.user?.userId);
  const post_id = Number(postId);

  try {
    const post = await prisma.posts.findUnique({
      where: { id: post_id },
      select: { user_id: true },
    });
    if (!post) {
      return res.status(404).json({ message: "Post Not Found" });
    }

    const findLiked = await prisma.likes.findUnique({
      where: {
        user_id_post_id: { user_id: userId, post_id },
      },
    });

    if (findLiked) {
      await prisma.likes.delete({
        where: { user_id_post_id: { user_id: userId, post_id } },
      });

      try {
        if (post.user_id && Number(post.user_id) !== userId) {
          const existing = await prisma.notifications.findMany({
            where: {
              recipient_id: Number(post.user_id),
              actor_id: userId,
              post_id,
              type: "like",
            },
            select: { id: true },
          });
          if (existing.length > 0) {
            await prisma.notifications.deleteMany({
              where: { id: { in: existing.map((item) => item.id) } },
            });
            for (const item of existing) {
              await emitNotificationRemoved(
                item.id,
                Number(post.user_id)
              );
            }
          }
        }
      } catch (err) {
        console.log("Error removing like notification", err);
      }

      return res.status(200).json({ liked: false });
    }

    await prisma.likes.create({
      data: { user_id: userId, post_id },
    });

    try {
      if (post.user_id && Number(post.user_id) !== userId) {
        const notification = await prisma.notifications.create({
          data: {
            recipient_id: Number(post.user_id),
            actor_id: userId,
            type: "like",
            post_id,
            message: "liked your post",
          },
        });
        await emitNotification(notification.id);
      }
    } catch (err) {
      console.log("Error creating like notification", err);
    }

    return res.status(200).json({ liked: true });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
