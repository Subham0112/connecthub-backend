import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import { io } from "../app.js";

export const sendMessage = async (req: Request, res: Response) => {
  const { message, recieverId } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: "User Not Authorized" });
  }

  if (Number(userId) === Number(recieverId)) {
    return res.status(400).json({ message: "You Can't Send Message to Yourself" });
  }

  try {
    const findUser = await prisma.users.findUnique({
      where: { id: Number(recieverId) },
    });

    if (!findUser) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const newMessage = await prisma.messages.create({
      data: {
        sender_id: Number(userId),
        receiver_id: Number(recieverId),
        messages: message,
      },
    });

    return res.status(200).json({
      message: "Message Sent",
      data: newMessage,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const limit = 8;
const before = req.query.before as string | undefined;
  const userId = req.user?.userId;
  const { otherUserId } = req.params;

  if (!userId) {
    return res.status(401).json({ message: "User Not Authorized" });
  }

  try {
    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: Number(userId), receiver_id: Number(otherUserId) },
          { sender_id: Number(otherUserId), receiver_id: Number(userId) },
        ],
        ...(before && {
      id: {
        lt: Number(before),
      },
    })
      },
      orderBy: { created_at: "desc" },
      take:limit
    });

   return res.json({
    data: messages.reverse(),
    hasMore: messages.length === limit,
});
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getConversations = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "User Not Authorized" });

  try {
    const messages = await prisma.messages.findMany({
      where: {
        OR: [{ sender_id: Number(userId) }, { receiver_id: Number(userId) }],
      },
      include: {
        sender: { select: { id: true, user_name: true, profile_url: true } },
        receiver: { select: { id: true, user_name: true, profile_url: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const unreadCounts: Record<number, number> = {};
    for (const msg of messages) {
  if (msg.receiver_id === Number(userId) && msg.is_read !== true) { 
    unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
  }
}

    const conversations: Record<number, any> = {};
    for (const msg of messages) {
      const isSender = msg.sender_id === Number(userId);
      const partner = isSender ? msg.receiver : msg.sender;
      if (partner && !conversations[partner.id]) {
        conversations[partner.id] = {
          userId: partner.id,
          name: partner.user_name,
          lastMessage: msg.messages,
          lastMessageAt: msg.created_at,
          profile_url: partner.profile_url ?? null,
          unreadCount: unreadCounts[partner.id] || 0,
        };
      }
    }

    return res.status(200).json({ message: "Conversations Fetched", data: Object.values(conversations) });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteChat=async(req:Request,res:Response)=>{
  const {chatId}=req.params
  const userId=req.user?.userId
try{
  const findChat=await prisma.messages.findUnique({
    where:{id:Number(chatId)}
  })
  if(!findChat){
    return res.status(404).json({
      message:"Chat doesnt found"
    })
  }
  if(Number(userId)!==Number(findChat.sender_id)){
    return res.status(403).json({
      message:"Users can delete their own chat message only"
    })
  }

  const deleteMessage=await prisma.messages.delete({
    where:{id:Number(chatId)}
  })
  io.to(`user_${findChat.receiver_id}`).emit("message_deleted", {
  messageId: Number(chatId),
});
  return res.status(200).json({
    message:"Chat deleted Successfully"
  })

}catch(err){
  return res.status(500).json({
    message:"Internal Server Error"
  })
}
}


export const getTotalUnread = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "User Not Authorized" });

  try {
  const count = await prisma.messages.count({
  where: { 
    receiver_id: Number(userId), 
    is_read: { not: true } 
  },
});
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
export const markMessagesRead = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { otherUserId } = req.params;
  if (!userId) return res.status(401).json({ message: "User Not Authorized" });

  try {
    await prisma.messages.updateMany({
    where: {
    sender_id: Number(otherUserId),
    receiver_id: Number(userId),
    is_read: { not: true }, 
  },
  data: { is_read: true },
});
    return res.status(200).json({ message: "Marked as read" });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};