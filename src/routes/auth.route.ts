
import {register,login,uploadProfile,getUser,refreshToken,forgetPassword,verifyOtp,resetPassword,getAllUsers, logout, resendOtp, passwordChange,deleteUser,logoutFromAll, getUserById} from "../controllers/login.controller.js";
import {verifyToken} from "../middleware/verifyToken.js";
import {authSudoAdmin, authAdmin,} from '../middleware/auth.js';
import upload from "../multer.js";
import { Router } from "express";

export const userRouter=Router()



userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.get("/profile", verifyToken, getUser);
userRouter.post("/refresh-token", refreshToken);
userRouter.post(
  "/upload-profile",
  verifyToken,                   
  upload.single("profile"),      
  uploadProfile
);
userRouter.get("/user/:userId",verifyToken, getUserById)
userRouter.post("/forget-password",forgetPassword);
userRouter.post('/verify-otp',verifyOtp);
userRouter.patch('/reset-password',resetPassword);
userRouter.patch('/resend-otp',resendOtp)
userRouter.patch("/change-password",passwordChange)
userRouter.post("/logout",logout);
userRouter.delete("/deleteUser/:id",verifyToken,deleteUser)
userRouter.patch("/logout-from-all",verifyToken, logoutFromAll)