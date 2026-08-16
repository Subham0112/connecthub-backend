
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import fs from "fs"
import path from "path";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});



const transporter=nodemailer.createTransport({
    host: String(process.env.EMAIL_HOST),
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth:{
        user: String(process.env.EMAIL_USER),
        pass: String(process.env.EMAIL_PASS)
    }
})

export const register = async (req:Request, res:Response)=>{
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues });
        }

        const {name,email,password,role} = parsed.data;
        const findUser=await prisma.users.findUnique({
            where:{email}
        })
        if(findUser){
            return res.status(409).json({ message: "User already exists" });
        }

        const hashPassword= await bcrypt.hash(password,10);
        const user = await prisma.users.create({
        data: { user_name: name, email, password: hashPassword, role:role ?? null },
        select: { id: true, user_name: true, email: true, role: true, token_version: true }
        });


        const accessToken=jwt.sign(
            {
                userId:user.id,
                user_name:user.user_name,
                email:user.email,
                role:user.role,
                token_version:user.token_version
            },
            String(process.env.ACCESS_SECRET),
            {expiresIn:"1h"}
        )
        const refreshToken=jwt.sign(
            {
                userId:user.id,
                role:user.role,
                token_version:user.token_version
            },
           String(process.env.REFRESH_SECRET),
            {expiresIn:"7d"}
        )
     
        await prisma.users.update({
            where:{id:user.id},
            data: { refresh_token: refreshToken }
        });

        res.cookie("accesstoken",accessToken,{
            httpOnly:true,
            sameSite:"lax",
            secure:false,
        })
        res.cookie("refreshtoken",refreshToken,{
            httpOnly:true,
            sameSite:"lax",
            secure:false,
        })

        res.status(201).json(
            {message:"User Registered Successfully",
            user:{ id: user.id, email: user.email, role: user.role, user_name: user.user_name },
            })
    } catch (err) {
        console.error("Error creating user", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const login = async (req:Request ,res:Response )=>{
    try{
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues  });
        }

        const {email,password}=parsed.data;
        const findUser= await prisma.users.findUnique({
            where: {email},
            select: {
        id: true,
        user_name: true,
        email: true,
        role: true,
        password: true,
        token_version: true,
        profile_url:true
        }});
        if (!findUser){
             return res.status(409).json({
              message: "Invalid email or password"
           });
        }
        const matchPassword= await bcrypt.compare(password,findUser.password ?? "")
        if(!matchPassword){
            return res.status(409).json({
                message:"Invalid email or password"
            })
        }

        const accessToken=jwt.sign(
            {
                userId:findUser.id,
                user_name:findUser.user_name,
                email:findUser.email,
                role:findUser.role,
                token_version:findUser.token_version
            },
            String(process.env.ACCESS_SECRET),
            {expiresIn:"1h"}
        )
        const refreshToken=jwt.sign(
            {
                userId:findUser.id,
                role:findUser.role,
                token_version:findUser.token_version
            },
           String(process.env.REFRESH_SECRET),
            {expiresIn:"7d"}
        )
     
        await prisma.users.update({
            where:{id:findUser.id},
            data:{refresh_token: refreshToken}
        });

        res.cookie("accesstoken",accessToken,{
            httpOnly:true,
            sameSite:"lax",
            secure:false,
        })
        res.cookie("refreshtoken",refreshToken,{
            httpOnly:true,
            sameSite:"lax",
            secure:false,
        })
          res.json({
          message: "Login successful",
          user: { id: findUser.id, email: findUser.email, role:findUser.role,user_name:findUser.user_name },
           });
    }catch(err){
        console.error("Error Login Users users", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
   
};



export const uploadProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filename = req.file.filename;
    const profile_url = `${process.env.FILE_URL}/uploads/${filename}`;

    await prisma.users.update({
      where: { id: Number(userId) },
      data: { profile_url },
    });

    return res.status(200).json({
      message: "Profile picture updated successfully",
      profile_url,
    });
  } catch (err) {
    console.error("Error uploading profile", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const getUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = Number(userId);

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        user_name: true,
        email: true,
        role: true,
        profile_url: true
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }
    res.status(200).json({ message: "User fetched successfully", user });
  } catch (err) {
    console.error("Error fetching profile", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUserById=async (req:Request,res:Response)=>{
        const {userId} =req.params
        try{
             const user=await prisma.users.findFirst({
            where:{id:Number(userId)},
             select:{
                id:true,
                user_name:true,
                email:true,
                role:true,
                profile_url:true
            }
        })
        if(!user){
            return res.status(404).json({
                message:"User Not Found"
            })
        }
        res.status(200).json({
            user:user
        })


        }catch(err){
            res.status(500).json({
                message:"Internal Server Error"
            })
        }
       
}

export const refreshToken = async (req:Request,res:Response)=>{
    try{
        const refreshToken=req.cookies.refreshtoken;
        if(!refreshToken){
            return res.status(401).json({
                message: "No refresh token found"
            })
        }
        const decoded:any=jwt.verify(refreshToken,String(process.env.REFRESH_SECRET)) ;
        const userId=decoded.userId;

        const findUser= await prisma.users.findUnique({
            where:{id:userId}
        })
        if(!findUser){
            return res.status(401).json({
                message: "Invalid refresh token"
            })
        }
        if(findUser.refresh_token !== refreshToken){
            return res.status(401).json({
                message: "Invalid refresh token"
            })
        }

        const newAccessToken=jwt.sign(
            {
                userId:findUser.id,
                name:findUser.user_name,
                role:findUser.role,
                email:findUser.email,
                token_version:findUser.token_version
            },
            String(process.env.ACCESS_SECRET),
            {expiresIn:"1h"}
        )
        res.cookie("accesstoken",newAccessToken,{
             httpOnly:true,
            sameSite:"lax",
            secure:false,
        });
        res.status(200).json({
            message: "Access token refreshed successfully"
        })  
    }catch(err){
        console.error("Error refreshing access token", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
   
}

export const forgetPassword =async (req:Request,res:Response)=>{
    try{
       const { email } = req.body;
        const findEmail= await prisma.users.findUnique({
            where:{email}
        })
        if(!findEmail){
            return res.status(404).json({
                message: "Email not found"
            })
        }

        const otp=Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt= new Date(Date.now() + 2* 60* 1000);
        await prisma.otp_table.create({
            data:{
                email:email,
                otp:otp,
                expires_at:expiresAt
            }
        })

        try{
            const mailInfo= await transporter.sendMail({
                from: String(process.env.EMAIL_USER),
                to: email,
                subject: "Password Reset Request",
                text: "You requested a password reset. Please use the following OTP to reset your password",
                html: `<p>You requested a password reset. Please use the following OTP to reset your password:</p><h2>${otp}</h2>`
            })
            res.status(200).json({
                message: "Password reset otp sent on email",
            })
        }catch(err){
            console.error("Error sending email", err);
            return res.status(500).json({
                message: "Error sending email"
            })
        }
            
    }catch(err){
        console.error("Error in forget password", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const verifyOtp = async (req:Request,res:Response)=>{
    try{
        const {otp,email}=req.body;
        const findOtp=await prisma.otp_table.findFirst({
            where:{email:email,otp:otp},
        })
        if(!findOtp){
            return res.status(400).json({
                message: "Invalid OTP"
            })
        }
        if(!findOtp.expires_at || new Date() > new Date(findOtp.expires_at)){
            return res.status(400).json({
                message: "OTP expired"
            })
        }
    
        res.status(200).json({
            message: "OTP verified successfully"
        })
    }catch(err){
        console.error("Error in verify OTP", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const resetPassword=async (req:Request,res:Response)=>{
    try{
        const {newPassword, email}=req.body;
        const hashedNewPassword=await bcrypt.hash(newPassword,15);
        const changePassword=await prisma.users.update({
            where:{
                email
            },
            data:{password:hashedNewPassword},
            select:{
                id:true,
                user_name:true,
                email:true
            }
        });
        
        if(!changePassword){
            res.status(404).json({
                message:"User Not Found"
            })
        }
        res.status(200).json({
            message:"Password Reset Successful",
            user:changePassword
        })
        await prisma.otp_table.deleteMany({
            where:{email}
        })
        

    }catch(err){
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
};

export const resendOtp=async (req:Request,res:Response)=>{
    try{
   const {email}=req.body;
   const checkOtp=await prisma.otp_table.findFirst({
    where:{email}
   })
    if(!checkOtp){
        return res.status(404).json({
                message: "Invalid email"
            })
    }
        const otp=Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt= new Date(Date.now() + 2* 60 *1000);
        await prisma.otp_table.updateMany({
            where:{email},
            data:{otp,expires_at:expiresAt}
        })
           try{
            const mailInfo= await transporter.sendMail({
                from: String(process.env.EMAIL_USER),
                to: email,
                subject: "OTP resend Request",
                html: `<p>You requested a password reset. Please use the following OTP to reset your password:</p><h2>${otp}</h2>`
            })
            res.status(200).json({
                message: "otp send successfully",
            })
        }catch(err){
            console.error("Error sending otp", err);
            return res.status(500).json({
                message: "Error sending otp"
            })
        }
    }catch(err){
        res.status(500).json({
            message:"Internal server error"
        })
    }
        }

export const passwordChange =async (req:Request,res:Response)=>{
    try{
        const {email,password,changePassword}=req.body;
        console.log("email is:",email)
        const checkUser=await prisma.users.findUnique({
            where:{email},
        })
    
    if (!checkUser){
        return res.status(404).json({
            message:"Invalid Email or password "
        })
    }
   const matchPassword= await bcrypt.compare(password,checkUser.password ?? "")
        if(!matchPassword){
           return res.status(400).json({
            message:"Invalid email or password"
           })
        }
    const matchNewPassword=await bcrypt.compare(changePassword,checkUser.password ?? "")
    if(matchNewPassword){
        return res.status(400).json({
            message:"New password and Old password are same "
        })
    }

    const hashedNewPassword=await bcrypt.hash(changePassword,15);
    const updatePassword=await prisma.users.update({
        where:{email},
        data:{password:hashedNewPassword},
        select:{id:true,user_name:true,email:true}
    })
    res.clearCookie("refreshtoken");
    res.clearCookie("accesstoken");
     res.status(200).json({
        message:"Password Changed Successfully",
        user:updatePassword
    })
    }catch (err){
        res.status(500).json({
            message:"Internal Server Error"
        })
    }

}

export const logout= async (req:Request,res:Response)=>{
    res.clearCookie("refreshtoken");
    res.clearCookie("accesstoken");
    res.status(200).json({message:"Logged out successfully"})
}

export const getAllUsers = async(req:Request,res:Response)=>{
    try{
        const result=await prisma.users.findMany();
    res.status(200).json(result);
    }catch(err){
        res.status(500).json({error:"Internal Server Error"})
    }
    
}

export const deleteUser = async(req:Request,res:Response)=>{
    try{
        const { id }=req.params;
        const user_id=Number(id)
        const requestedId=req.user?.userId;
        const requestedRole=req.user?.role;

      
        try{
              if(requestedRole==="sudoadmin"){
            const fileFind=await prisma.media.findMany({
                where:{user_id},
            })
              
        

           for (const file of fileFind) {
                 const filePath = path.join("src/uploads", file.filename??"");

                fs.unlink(filePath, (err) => {
                 if (err) {
                 console.log("File delete error:", err.message);
                     } else {
                    console.log("Deleted:", file.filename);
                 }
                  });
                     }   
                     await prisma.users.deleteMany({
                        where:{id:user_id}
                     })
            return res.status(200).json({
                message:"User deleted successfully"
            })
        }

        }catch{
            res.status(401).json({
                error:"Error Deleting User"
            })
        }

        if(requestedRole==="admin"){
            const targetedUsers=await prisma.users.findFirst({
                where:{id:user_id}
            })
            if(!targetedUsers){
                return res.status(404).json({
                    error:"Invalid user id "
                })
            }
            if(targetedUsers.role!=="user"){
                return res.status(403).json({
                    message:"Admin can delete only regular users"
                })
            }
            const fileFind=await prisma.media.findMany({
                where:{user_id}
            })
        

           for (const file of fileFind) {
                 const filePath = path.join("src/uploads", file.filename??"");

                fs.unlink(filePath, (err) => {
                 if (err) {
                 console.log("File delete error:", err.message);
                     } else {
                    console.log("Deleted:", file.filename);
                 }
                  });
                     }   
            await prisma.users.delete({
                where:{id:user_id}
            })
            return res.status(200).json({
                message:"User deleted Successfully"
            })
        }

        if(String(requestedId)!==String(id)){
            return res.status(403).json({
                error:"Users can delete their own account"
            })
        }
        const fileFind=await prisma.media.findMany({
            where:{user_id}
        })
          
           for (const file of fileFind) {
                 const filePath = path.join("src/uploads", file.filename ?? "");

                fs.unlink(filePath, (err) => {
                 if (err) {
                 console.log("File delete error:", err.message);
                     } else {
                    console.log("Deleted:", file.filename);
                 }
                  });
                     }   
                     await prisma.users.delete({
                        where:{id:user_id}
                     })
        res.clearCookie("accesstoken"),
        res.clearCookie("refreshtoken")
        return res.status(200).json({
            message:"Successfully deleted users."
        })

    }catch(err){
        return res.status(500).json({
            error:"Internal Server Error"
        })
    }
}


export const logoutFromAll = async (req:Request, res:Response)=>{
    try{
        const userId=req.user?.userId
        const id=Number(userId)
        await prisma.users.update({
            where:{id:id},
            data:{token_version:{
                increment:1
            },refresh_token:""}
        })

        res.clearCookie("accesstoken");
        res.clearCookie("refreshtoken")
       

        return res.status(200).json({
            message:"Successfully Logout from all devices"
        })

    }catch(err){
    
        return res.status(500).json({
            error:"Internal Server Error"
        })
    }

}