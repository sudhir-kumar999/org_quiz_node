import { JwtPayload } from "jsonwebtoken";
import jwt from 'jsonwebtoken';

interface payload extends JwtPayload {
  name: string;
  email: string;
  id: string;
  role:string
}

export const generateAccessToken=(payload:payload)=>{
  const secret=process.env.JWT_SECRET as string;
  const token=jwt.sign(payload,secret);
  return token;
};

export const verifyToken=(token:string)=>{
  const secret=process.env.JWT_SECRET as string;
  return jwt.verify(token,secret)
}