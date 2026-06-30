import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/generateToken";

interface decode{
    name: string;
  email: string;
  id: string|number;
  role:string
}
interface RequestWithRole extends Request{
   user?:decode
}

export const checkLogin=(req:RequestWithRole,res:Response,next:NextFunction)=>{
  try {
    const token=req.cookies.accessToken;
    if(!token){
      return res.status(401).json({
        success:false,
        message:"You are not logged in. Log in first"
      });
    }

    const decode = verifyToken(token) as decode;
    if(!decode){
      return res.status(403).json({
        success:false,
        message:"wrong token, unauthorize user"
      });
    }
    // console.log(decode)

    req.user=decode;
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: error.message || "internal server error",
      });
    }
  }
};