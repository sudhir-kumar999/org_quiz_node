import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Superadmin } from "../entity/Superadmin";
import { generateAccessToken } from "../utils/generateToken";
import { User } from "../entity/User";
import { Organization } from "../entity/Organization";
import { sendGrid } from "../utils/SendGrid";
const adminRepo = AppDataSource.getRepository(Superadmin);
const userRepo = AppDataSource.getRepository(User);
const superAdminRepo = AppDataSource.getRepository(Superadmin);
const orgRepo = AppDataSource.getRepository(Organization);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
interface decode {
  name: string;
  email: string;
  id: string | number;
  role: string;
}
interface RequestWithRole extends Request {
  user?: decode;
}
export const adminLogin = async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    const { password } = req.body;
    if (!email || !password) {
      return res.status(401).json({
        success: false,
        message: "Email and Password is required for login",
      });
    }
    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid email",
      });
    }

    const admin = await userRepo.findOne({
      where: {
        email,
      },
    });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "You are not admin.",
      });
    }

    const verify = admin.password == password;
    console.log(verify);

    if (!verify) {
      return res.status(401).json({
        success: false,
        message: "Wrong password. Try again.",
      });
    }

    const payload = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
    const accessToken = await generateAccessToken(payload);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "login successfully",
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
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

export const createOrg = async (req: RequestWithRole, res: Response) => {
  try {
    console.log("from org creation");
    const { title, max_teacher, max_student, email ,password} = req.body;
    const admin_id = req.user?.id;
    let admin = await userRepo.findOne({
      where: {
        id: admin_id as string,
        role: "superadmin",
      },
    });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "You are not allowed to create organization.",
      });
    }
    const orgDetails = {
      title: title,
      max_teacher,
      max_student,
      created_by: admin,
    };
    let orgSave = await orgRepo.save(orgDetails);
    console.log(orgSave);
    const userDetails = {
      email: email,
      password: password,
      role: "manager",
      organizations: orgSave,
      invited_by: admin,
      expAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

    };
    let savedData = await userRepo.save(userDetails);
    orgSave.manager = savedData;
    await orgRepo.save(orgSave);

    const template=`
    <h1>Hello ${savedData.email} you are manager of the organization ${orgSave.title}</h1>
    <h2>Given below your Email and default password</h2>
    <p>Change the password after first login</p>
    <p><strong>EMail: ${savedData.email}</strong></p>
    <p><strong>Password: ${savedData.password}</strong></p>
    <p>Login before 7 days otherwise the link will expire</p>
    `

    const sendMail=await sendGrid(savedData.email,template)
    console.log(sendMail)
    res.status(200).json({
        success: true,
        message: "invitation mail send on manager mail",
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
