import express from "express";
import type { Express} from "express";
import "reflect-metadata";
import { createServer } from "http"; 
import { Server } from "socket.io";  
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { userRouter } from "./routes/auth.route.js";
import { postRouter } from "./routes/posts.route.js";
import { friendRouter } from "./routes/friends.route.js";
import path from "path";
import { fileURLToPath } from "url";
import { messageRouter } from "./routes/message.route.js";
import prisma from "./config/prisma.js";
dotenv.config();

const app:Express= express();
 const httpServer=createServer(app)

 export const io= new Server(httpServer,{
    cors:{
        origin:true,
        credentials:true
    }
 })

 
const userSocketMap = new Map<number, Set<string>>()

io.on("connection", (socket) => {
  console.log("User Connected", socket.id)

  socket.on("join", (userId: number) => {
    socket.join(`user_${userId}`)
    
    if (!userSocketMap.has(Number(userId))) {
      userSocketMap.set(Number(userId), new Set())
    }
    userSocketMap.get(Number(userId))!.add(socket.id)
    console.log(`User ${userId} joined — sockets:`, [...userSocketMap.get(Number(userId))!])
  })

  socket.on("send_message", async (data) => {
    const { senderId, receiverId, message } = data
    try {
      io.to(`user_${receiverId}`).emit("receive_message", {
        sender_id: senderId,
        receiver_id: receiverId,
        messages: message,
        created_at: new Date(),
        id: Date.now(),
        is_read: false,
      })
      // Realtime badge: push the receiver's fresh unread-conversation count
      const unreadRows = await prisma.messages.findMany({
        where: { receiver_id: Number(receiverId), is_read: false },
        select: { sender_id: true },
        distinct: ["sender_id"],
      })
      io.to(`user_${receiverId}`).emit("total_unread_count", unreadRows.length)
    } catch (err) {
      socket.emit("error", { message: "Message failed" })
    }
  })

  socket.on("typing", (data) => {
    const { receiverId, senderId } = data
    io.to(`user_${receiverId}`).emit("user_typing", { senderId })
  })

  socket.on("stop_typing", (data) => {
    const { receiverId, senderId } = data
    io.to(`user_${receiverId}`).emit("user_stop_typing", { senderId })
  })
  socket.on("messages_read", (data) => {
    const senderSockets = userSocketMap.get(Number(data.senderId))
    if (senderSockets) {
      for (const sid of senderSockets) {
        io.to(sid).emit("messages_read", { readerId: data.readerId })
      }
      console.log(`Emitted messages_read to ${senderSockets.size} socket(s) for user ${data.senderId}`)
    } else {
      console.log(`No sockets found for user ${data.senderId}`)
    }
  })

  socket.on("disconnect", () => {
    // Remove only this specific socket from all user entries
    for (const [userId, sockets] of userSocketMap.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          userSocketMap.delete(userId)
        }
        break
      }
    }
    console.log("User disconnected:", socket.id)
  })
})

app.use(express.json());

app.use(cors({
    origin:true,
    credentials:true,
}));
app.use(cookieParser())

const port = Number(process.env.PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "../src/uploads")))
app.use("/",userRouter)
app.use("/",postRouter)
app.use("/",messageRouter)
app.use("/",friendRouter)

// Important: Socket.IO is attached to `httpServer` (see top of file), so we
// must start THAT server — `app.listen()` would create a second, separate
// HTTP server that never runs Socket.IO.
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});