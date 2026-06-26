import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
const userRepo = AppDataSource.getRepository(User);

interface decode {
  name: string;
  email: string;
  id: string;
  role: string;
  org_id: string;
}
interface RequestWithRole extends Request {
  user?: decode;
}
export const getMe = async (req: RequestWithRole, res: Response) => {
  try {
    const id = req.user?.id;
    const accessToken=req.cookies.accessToken
if(!accessToken){
        return res.status(400).json({
        success: false,
        message: "No token details found login again",
      });
    }
    if(!id){
        return res.status(400).json({
        success: false,
        message: "No token details found login again",
      });
    }
    console.log(id);
    // console.log(req.user)
    const org_id = req.user;
    console.log(org_id);
    const user = await userRepo.findOne({
      where: {
        id: id
      },
      relations: {
        organizations: true,
      },
    });
    console.log(user);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No user found with login details login again ",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched",
accessToken,
      data: {
        id:user.id,
        email:user.email,
        name:user.name,
        role:user.role,
        organization:user?.organizations,
        isBanned:user?.isBanned,
  isDefPassUsed:user?.isDefPassUsed

      }
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: error.message || "internal server error",
      });
    }
  }
};
