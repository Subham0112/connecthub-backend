
import { Router } from "express";
import { uploadPost,deletePost,getUsersPostWithFiles, getAllPost, editPost, getAllLikedUser } from "../controllers/fileupload.controller.js";
import {verifyToken} from "../middleware/verifyToken.js";
import { toggleLike } from "../controllers/like.controller.js";
import { deleteComment, getAllPostComments, postComment } from "../controllers/comment.controller.js";
import upload from "../multer.js";


export const postRouter=Router()

postRouter.post("/upload-file",upload.array("file", 10),uploadPost)
postRouter.get("/get-post/:id",verifyToken, getUsersPostWithFiles)
postRouter.get("/get-all-posts",verifyToken,getAllPost)
postRouter.get("/getLikes/:postId",verifyToken,getAllLikedUser)
postRouter.patch("/update-post", verifyToken,editPost)
postRouter.delete("/delete-post/:id",verifyToken,deletePost)
postRouter.post("/toggle-like/:postId",verifyToken,toggleLike)
postRouter.post("/post-comment",verifyToken,postComment)
postRouter.get("/get-comments/:post_id",verifyToken,getAllPostComments)
postRouter.delete("/delete-comment/:commentId",verifyToken,deleteComment)