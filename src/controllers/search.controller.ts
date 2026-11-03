import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import { getLikersByPostIds, type PostLiker } from "../utils/postLikers.js";

type SearchType = "all" | "users" | "posts";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatPost = (post: any, likers: PostLiker[] = []) => ({
  id: post.id,
  user_id: post.user_id,
  content: post.content,
  visiblity: post.visiblity,
  created_at: post.created_at,
  updated_at: post.updated_at,
  media: post.media ?? [],
  users: post.users ?? null,
  likeCount: post._count?.likes ?? 0,
  commentCount: post._count?.comments ?? 0,
  likedByCurrentUser: (post.likes?.length ?? 0) > 0,
  likers,
});

export const search = async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.query.q ?? "").trim();
    const type = (["all", "users", "posts"].includes(String(req.query.type))
      ? String(req.query.type)
      : "all") as SearchType;

    const page = clamp(Number(req.query.page) || 1, 1, 10000);
    const limit = clamp(Number(req.query.limit) || 10, 1, 50);
    const skip = (page - 1) * limit;
    const viewerId = Number(req.user?.userId);

    if (!rawQuery) {
      return res.status(200).json({
        query: "",
        users: { items: [], total: 0, page, limit },
        posts: { items: [], total: 0, page, limit },
      });
    }

    const userWhere = {
      OR: [
        { user_name: { contains: rawQuery, mode: "insensitive" as const } },
        { email: { contains: rawQuery, mode: "insensitive" as const } },
      ],
    };

    const postWhere = {
      AND: [
        {
          OR: [
            { content: { contains: rawQuery, mode: "insensitive" as const } },
            {
              users: {
                is: {
                  user_name: { contains: rawQuery, mode: "insensitive" as const },
                },
              },
            },
          ],
        },
        {
          OR: [
            { visiblity: "all" },
            ...(Number.isFinite(viewerId) ? [{ user_id: viewerId }] : []),
          ],
        },
      ],
    };

    const wantUsers = type === "all" || type === "users";
    const wantPosts = type === "all" || type === "posts";

    const [users, usersTotal, posts, postsTotal] = await Promise.all([
      wantUsers
        ? prisma.users.findMany({
            where: userWhere,
            select: {
              id: true,
              user_name: true,
              email: true,
              profile_url: true,
            },
            orderBy: [{ user_name: "asc" }, { id: "asc" }],
            skip,
            take: limit,
          })
        : Promise.resolve([]),
      wantUsers ? prisma.users.count({ where: userWhere }) : Promise.resolve(0),
      wantPosts
        ? prisma.posts.findMany({
            where: postWhere,
            include: {
              media: true,
              users: {
                select: {
                  id: true,
                  user_name: true,
                  email: true,
                  profile_url: true,
                },
              },
              _count: { select: { likes: true, comments: true } },
              likes: {
                where: { user_id: Number.isFinite(viewerId) ? viewerId : -1 },
                select: { user_id: true },
              },
            },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            skip,
            take: limit,
          })
        : Promise.resolve([]),
      wantPosts ? prisma.posts.count({ where: postWhere }) : Promise.resolve(0),
    ]);

    const likersMap = await getLikersByPostIds(posts.map((post) => post.id));

    return res.status(200).json({
      query: rawQuery,
      users: {
        items: users,
        total: usersTotal,
        page,
        limit,
        hasMore: skip + users.length < usersTotal,
      },
      posts: {
        items: posts.map((post) =>
          formatPost(post, likersMap.get(post.id) ?? [])
        ),
        total: postsTotal,
        page,
        limit,
        hasMore: skip + posts.length < postsTotal,
      },
    });
  } catch (err) {
    console.error("Error searching", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
