import { Router } from "express";

import { deleteChat, getConversations, getMessages, getTotalUnread, markMessagesRead, sendMessage } from "../controllers/message.controller.js";
import {verifyToken} from "../middleware/verifyToken.js";


export const messageRouter = Router()


messageRouter.post("/message",verifyToken,sendMessage)
messageRouter.get("/message/:otherUserId",verifyToken,getMessages)
messageRouter.get("/get-conversation",verifyToken,getConversations)
messageRouter.patch("/messages/:otherUserId/read",verifyToken,markMessagesRead)
messageRouter.delete("/delete-message/:chatId",verifyToken,deleteChat)
messageRouter.get("/total-unread",verifyToken,getTotalUnread)
