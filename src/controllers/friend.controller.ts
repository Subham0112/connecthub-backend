import prisma from "../config/prisma.js";
import type { Request, Response } from "express";

export const sendFriendRequest = async (req: Request, res: Response) => {
  const { receiverId } = req.params;
  const userId = req.user?.userId;

  try {
    const receiverExists = await prisma.users.findUnique({
      where: { id: Number(receiverId) },
    });

    if (!receiverExists) {
      return res.status(404).json({
        message: "User Not Found",
      });
    }
    if (Number(receiverId) === Number(userId)) {
      return res.status(403).json({
        message: "You cannot Send Friend Request to Yourself",
      });
    }

    const existingFriend = await prisma.friends.findFirst({
      where: {
        OR: [
          {
            sender_id: Number(userId),
            receiver_id: Number(receiverId),
          },
          {
            sender_id: Number(receiverId),
            receiver_id: Number(userId),
          },
        ],
      },
    });
    if (existingFriend) {
      if (existingFriend.friend_status === "pending") {
        return res.status(400).json({
          message: "Friend request already Exist ",
        });
      }
      if (existingFriend.friend_status === "accepted") {
        return res.status(400).json({
          message: "You are already friends with this user",
        });
      }
    }

    await prisma.friends.create({
      data: {
        sender_id: Number(userId),
        receiver_id: Number(receiverId),
      },
    });
    return res.status(200).json({
      message: "Friend Request Sent",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
  const { senderId } = req.params;
  const userId = req.user?.userId;
  try {
    const findRequest = await prisma.friends.findFirst({
      where: {
        sender_id: Number(senderId),
        receiver_id: Number(userId),
        friend_status: "pending",
      },
    });
    if (!findRequest) {
      return res.status(404).json({
        message: "Request Doesn't Found",
      });
    }
    await prisma.friends.update({
      where: { friends_id: Number(findRequest.friends_id) },
      data: {
        friend_status: "accepted",
        accepted_at: new Date(),
      },
    });

    return res.status(200).json({
      message: "Request Accepted Successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const requestCancel = async (req: Request, res: Response) => {
  const { receiverId } = req.params;
  const userId = req.user?.userId;

  try {
    const requestExist = await prisma.friends.findFirst({
      where: {
        sender_id: Number(userId),
        receiver_id: Number(receiverId),
        friend_status: "pending",
      },
    });
    if (!requestExist) {
      return res.status(404).json({
        message: "Friend Request Not Found",
      });
    }
    await prisma.friends.delete({
      where: {
        friends_id: requestExist.friends_id,
      },
    });
    return res.status(200).json({
      message: "Friend Request Cancelled",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const unfriendUser = async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const userId = req.user?.userId;

  try {
    const friendExists = await prisma.friends.findFirst({
      where: {
        OR: [
          {
            sender_id: Number(userId),
            receiver_id: Number(friendId),
            friend_status: "accepted",
          },
          {
            sender_id: Number(friendId),
            receiver_id: Number(userId),
            friend_status: "accepted",
          },
        ],
      },
    });
    if (!friendExists) {
      return res.status(404).json({
        message: "Friend Not Found",
      });
    }
    await prisma.friends.delete({
      where: {
        friends_id: friendExists.friends_id,
      },
    });
    return res.status(200).json({
      message: "Unfriended Successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const deletefriendRequest = async (req: Request, res: Response) => {
  const { senderId } = req.params;
  const userId = req.user?.userId;

  try {
    const requestExist = await prisma.friends.findFirst({
      where: {
        sender_id: Number(senderId),
        receiver_id: Number(userId),
        friend_status: "pending",
      },
    });
    if (!requestExist) {
      return res.status(404).json({
        message: "Request Not Found",
      });
    }
    await prisma.friends.delete({
      where: {
        friends_id: Number(requestExist.friends_id),
      },
    });

    return res.status(200).json({
      message: "Request Deleted Successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getUsersAllFriends = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  try {
    const findFriend = await prisma.friends.findMany({
      where: {
        OR: [
          {
            sender_id: Number(userId),
            friend_status: "accepted",
          },
          {
            receiver_id: Number(userId),
            friend_status: "accepted",
          },
        ],
      },
      include: { req_sender: true, req_receiver: true },
    });
    return res.status(200).json({
      friends: findFriend,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllFriendRequests = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  try {
    const findRequest = await prisma.friends.findMany({
      where: {
        receiver_id: Number(userId),
        friend_status: "pending",
      },
      include: { req_sender:{
        select:{
          id:true,
          user_name:true,
          profile_url:true,
        }
      } },
    });
    return res.status(200).json({
      friendRequest: findRequest,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getSentRequests = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  try {
    const findSentRequests = await prisma.friends.findMany({
      where: {
        sender_id: Number(userId),
        friend_status: "pending",
      },
      include: { req_receiver:{
        select:{
          id:true,
          user_name:true,
          profile_url:true,
        }
      }},
    });
    return res.status(200).json({
      sentRequest: findSentRequests,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getOtherUserFriends = async (req: Request, res: Response) => {
  const { otherUserId } = req.params;
  try {
    const existUser = await prisma.users.findUnique({
      where: { id: Number(otherUserId) },
    });
    if (!existUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const findOtherUserFriends = await prisma.friends.findMany({
      where: {
        OR: [
          {
            sender_id: Number(otherUserId),
            friend_status: "accepted",
          },
          {
            receiver_id: Number(otherUserId),
            friend_status: "accepted",
          },
        ],
      },
      include: { req_receiver: true, req_sender: true },
    });
    return res.status(200).json({
      friends: findOtherUserFriends,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getFriendsStatus = async (req: Request, res: Response) => {
  const { otherUserId } = req.params;
  const userId = req.user?.userId;
  try {
    const existUser = await prisma.users.findUnique({
      where: { id: Number(otherUserId) },
    });
    if (!existUser) {
      return res.status(404).json({
        message: "User Not Found",
      });
    }

    const showStatus = await prisma.friends.findFirst({
      where: {
        OR: [
          {
            sender_id: Number(otherUserId),
            receiver_id: Number(userId),
          },
          {
            sender_id: Number(userId),
            receiver_id: Number(otherUserId),
          },
        ],
      },
    });
    if (!showStatus) {
      return res.status(200).json({
        status: "none",
      });
    }

    if (showStatus.friend_status === "accepted") {
      return res.status(200).json({
        status: "friends",
      });
    }

    if (
      showStatus.friend_status === "pending" &&
      showStatus.sender_id === Number(userId)
    ) {
      return res.status(200).json({
        status: "pending_sent",
      });
    }

    return res.status(200).json({
      status: "pending_received",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
