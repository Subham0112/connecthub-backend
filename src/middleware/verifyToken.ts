import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma.js";



export const verifyToken = async (req: Request,res: Response,next: NextFunction) => {
  const token = req.cookies.accesstoken;

  if (!token) {
    return res.status(401).json({
      message: "No access token found",
    });
  }

  try {
    const decoded = jwt.verify(
  token,
  String(process.env.ACCESS_SECRET)
) as { userId: string; role: string; email:string, token_version:number,profile_url:string};
    
const findUser=await prisma.users.findFirst({
  where:{id:Number(decoded.userId)}
})
  if(!findUser){
    return res.status(401).json({
      error:"Session expired, Please login again"
    })
  }
  if (Number(findUser.token_version )!== Number(decoded.token_version)) {
    return res.status(401).json({ error: "Logged out from all devices, please login again" });
}

   req.user=decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({
      message: "Access token expired",
    });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      message: "Invalid access token",
    });
  }

  console.error(err);

  return res.status(500).json({
    message: "Internal Server Error",
  });
  }
};
