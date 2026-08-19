import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import fs from "fs";
import path from "path";

export const uploadPost = async (req: Request, res: Response) => {
  const { userId, content, visibility } = req.body;
  const user_id = Number(userId);

  if (!content && !req.file) {
    return res
      .status(400)
      .json({ message: "Post must have content or a file" });
  }

  try {
    const postCreate = await prisma.posts.create({
      data: { content: content ?? "", user_id: user_id, visiblity: visibility },
      include: { users: true, likes: true },
    });
    let mediaCreate = null;
    if (req.file) {
      const { filename } = req.file;
      const fileUrl = `${process.env.FILE_URL}/uploads/${filename}`;
      mediaCreate = await prisma.media.create({
        data: {
          user_id: user_id,
          filename,
          file_url: fileUrl,
          post_id: postCreate.id,
        },
      });
    }
    res.status(200).json({
      message: "Post Created succesfully",
      file: mediaCreate,
      data: {
        ...postCreate,
        media: mediaCreate ? [mediaCreate] : [],
        likeCount: 0,
        commentCount: 0,
        likedByCurrentUser: false,
        likes: undefined,
      },
    });
  } catch (err) {
    console.log(err);
  }
};



export const getUsersPostWithFiles = async (req: Request, res: Response) => {
     const { id } = req.params 
     const viewerId = req.user?.userId
      const isOwner = Number(viewerId) === Number(id) 
      const posts = await prisma.posts.findMany({ 
        where:isOwner? { user_id: Number(id) }:{user_id:Number(id),visiblity:"all"}, 
        include: { media: true, users: true, 
            _count: { select: { likes: true,comments:true } },
             likes: { where: { user_id: Number(viewerId) },
              select: { user_id: true } 
            } 
        } 
    })
         const formatted = posts.map(post => ({ ...post, likeCount: post._count.likes, commentCount:post._count.comments,
             likedByCurrentUser: post.likes.length > 0,
              likes: undefined,
               _count: undefined })
            )
             return res.status(200).json({ posts: formatted }) }

export const getUsersPost = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const posts = await prisma.posts.findMany({
      where: { user_id: Number(id) },
      include: {
        media: true,
        users: true,
        _count: { select: { likes: true, comments: true } },
        likes: {
          where: { user_id: Number(id) },
          select: { user_id: true },
        },
      },
    });
    if (!posts) {
      res.status(404).json({
        message: "Post not Found",
      });
    }
    const formatted = posts.map((post) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      likedByCurrentUser: post.likes.length > 0,
      likes: undefined,
      _count: undefined,
    }));

    res.status(200).json({
      posts: formatted,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllPost = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const userId = req.user?.userId;
  const skip = (page - 1) * limit;

  try {
    // ── Engagement-based feed ranking (Facebook-like) ──────────────────
    // score = 3*likes + 4*comments + recencyBoost
    // recencyBoost = 50 * 0.5^(ageHours / 12)  → halves every 12 hours
    // Fresh posts start with a boost of ~50, engagement pushes them up,
    // and old posts decay away unless they keep getting engagement.
    const ranked = await prisma.$queryRaw<{ id: number; score: number }[]>`
      SELECT p.id,
        (
          COUNT(DISTINCT l.user_id) * 3.0
          + COUNT(DISTINCT c.id) * 4.0
          + EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p.created_at, NOW()))) * LN(2) / 43200.0) * 50.0
        )::float8 AS "score"
      FROM posts p
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.visiblity = 'all'
      GROUP BY p.id
      ORDER BY "score" DESC, p.id DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const scoreMap = new Map(ranked.map((r) => [r.id, r.score]));
    const ids = ranked.map((r) => r.id);

    const [posts, totalCount] = await Promise.all([
      ids.length > 0
        ? prisma.posts.findMany({
            where: { id: { in: ids } },
            include: {
              media: true,
              users: true,
              _count: { select: { likes: true, comments: true } },
              likes: {
                where: { user_id: Number(userId) },
                select: { user_id: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.posts.count({ where: { visiblity: "all" } }),
    ]);

    const formatted = posts
      .map((post) => ({
        ...post,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        likedByCurrentUser: post.likes.length > 0,
        score: Number(scoreMap.get(post.id) ?? 0),
        likes: undefined,
        _count: undefined,
      }))
      .sort((a, b) => b.score - a.score || b.id - a.id);

    return res.status(200).json({
      posts: formatted,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllLikedUser=async (req:Request,res:Response)=>{
    const {postId}=req.params
try{
    const findPosts=await prisma.posts.findUnique({
        where:{id:Number(postId)}
    })
    if(!findPosts){
        return res.status(404).json({
            message:"Posts Not Found"
        })
    }

    const findLikes=await prisma.likes.findMany({
        where:{post_id:Number(postId)},
        select:{users:{
            select:{id:true,user_name:true,profile_url:true}
        }}
    })

     return res.status(200).json({
            count: findLikes.length,
            likes:findLikes
        });


}catch(err){
    return res.status(500).json({
        message:"Internal Server Error"
    })
}

}


export const deletePost = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  try {
    const findPost = await prisma.posts.findFirst({
      where: { id: Number(id) },
    });
    if (!findPost) {
      return res.status(404).json({
        message: "Post Not Found",
      });
    }

    if (Number(userId) !== Number(findPost.user_id)) {
      return res.status(403).json({
        message: " Users only can delete their own post",
      });
    }
    const findFile = await prisma.media.findMany({
      where: { post_id: findPost.id },
    });

    await prisma.posts.delete({
      where: { id: findPost.id },
    });

    findFile.forEach((file) => {
      if (!file.filename) return;
      const filePath = path.join("src/uploads", file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting from local:", err);
      });
    });
    res.status(200).json({
      message: "File Deleted Successfully",
    });
  } catch (err) {
    console.log("Error deleting file", err);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const editPost = async (req: Request, res: Response) => {
  const { post_id, user_id, visibility, content } = req.body;
  const userId = req.user?.userId;
  try {
    if (Number(user_id) !== Number(userId)) {
      return res.status(400).json({
        message: "User can delete their own post only",
      });
    }

    const findPost = await prisma.posts.findFirst({
      where: { id: post_id },
    });
    if (!findPost) {
      return res.status(404).json({
        message: "Post Not Found",
      });
    }

    const updatePost = await prisma.posts.update({
      where: { id: post_id, user_id: user_id },
      data: { content, visiblity: visibility },
    });
    return res.status(200).json({
      message: "Successfully Updated Data",
      updatedPost: updatePost,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
