import type {Request,Response,NextFunction} from "express";

export const authSudoAdmin =(req:Request,res:Response,next:NextFunction)=>{

 const userRole=req.user?.role;
 if(userRole!=="sudoadmin"){
    return res.status(403).json({
        message:"Only accessable by SudoAdmins"
    })
 }

 next();
}

export const authAdmin=(req:Request,res:Response,next:NextFunction)=>{
    const userRole=req.user?.role;
    if(userRole!=="admin"){
        return res.status(403).json({
            message:"Admin accessable Route"
        })
    }

    next();
}
