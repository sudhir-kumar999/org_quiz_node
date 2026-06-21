import { NextFunction, Request, Response } from "express";
interface decode {
  name: string;
  email: string;
  id: string | number;
  role: string;
}
interface RequestWithRole extends Request {
  user?: decode;
}
export const authorize = (...roles: string[]) => {
  return (req: RequestWithRole, res: Response, next: NextFunction) => {
    const user=req.user
    if(!user){
        return res.status(401).json({
            success:false,
            message:"no user found"
        })
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You are not allowed to access this restricted content.",
      });
      return
    }
    next();
  };
};
