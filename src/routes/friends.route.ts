import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { acceptFriendRequest, deletefriendRequest, getAllFriendRequests, getFriendsStatus, getOtherUserFriends, getSentRequests, getUsersAllFriends, requestCancel, sendFriendRequest,unfriendUser } from "../controllers/friend.controller.js";
export const friendRouter = Router();

friendRouter.post("/add-friend/:receiverId",verifyToken,sendFriendRequest)
friendRouter.delete("/unfriend/:friendId",verifyToken,unfriendUser)
friendRouter.patch("/accept-request/:senderId",verifyToken,acceptFriendRequest)
friendRouter.delete("/request-cancel/:receiverId",verifyToken,requestCancel)
friendRouter.delete("/delete-request/:senderId",verifyToken,deletefriendRequest)
friendRouter.get("/allFriends",verifyToken,getUsersAllFriends)
friendRouter.get("/userFriends/:otherUserId",verifyToken,getOtherUserFriends)
friendRouter.get("/friend-request",verifyToken,getAllFriendRequests)
friendRouter.get("/sent-request",verifyToken,getSentRequests)
friendRouter.get("/friend-status/:otherUserId",verifyToken,getFriendsStatus)
