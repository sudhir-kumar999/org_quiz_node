import { NextFunction, Request, Response } from "express";


interface decode {
  name: string;
  email: string;
  id: string | number;
  role: string;
}
interface RequestWithRole extends Request {
  user: decode;
}
export const checkOrg=async(req:RequestWithRole,res:Response,next:NextFunction)=>{
    // const user=req?.user?.role
    if(req?.user.role=="superadmin"){
        return next()
    }

    

}