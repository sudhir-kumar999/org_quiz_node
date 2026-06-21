import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { generateAccessToken } from "../utils/generateToken";
import { User } from "../entity/User";
import { Organization } from "../entity/Organization";
import { sendGrid } from "../utils/SendGrid";
import crypto from "crypto";
import bcrypt from "bcrypt";
const userRepo = AppDataSource.getRepository(User);
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
    const { title, max_teacher, max_student, email } = req.body;
    const admin_id = req.user?.id;
    const admin = await userRepo.findOne({
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
    const user = await userRepo.findOne({
      where: {
        email,
      },
    });
    if (user) {
      return res.status(409).json({
        success: false,
        message: "This user is already invited.",
      });
    }
    const orgDetails = {
      title: title,
      max_teacher,
      max_student,
      created_by: admin,
    };
    const orgSave = await orgRepo.save(orgDetails);
    console.log(orgSave);
    const defPassword = crypto.randomBytes(3).toString("hex");
    const hashPassword = await bcrypt.hash(defPassword, 10);
    const userDetails = {
      email: email,
      password: hashPassword,
      role: "manager",
      organizations: orgSave,
      invited_by: admin,
      expAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    const savedData = await userRepo.save(userDetails);
    orgSave.manager = savedData;
    await orgRepo.save(orgSave);

    const template = `
    <h1>Hello ${savedData.email} you are manager of the organization ${orgSave.title}</h1>
    <h2>Given below your Email and default password</h2>
    <p>Change the password after first login</p>
    <p><strong>EMail: ${savedData.email}</strong></p>
    <p><strong>Password: ${defPassword}</strong></p>
    <p>Login before 7 days otherwise the link will expire</p>
    `;

    const sendMail = await sendGrid(savedData.email, template);
    console.log(sendMail);
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

export const resendMail = async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    if (!email) {
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

    const user = await userRepo.findOne({
      where: {
        email,
      },
      relations: {
        organizations: true,
      },
    });
    console.log(user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No user found to re-invite. Invite them first",
      });
    }

    if (user.role !== "manager") {
      return res.status(400).json({
        success: false,
        message: "user in not a manager",
      });
    }
    const currDate = new Date(Date.now());
    console.log(currDate);

    if (user.isDefPassUsed) {
      return res.status(400).json({
        success: false,
        message: "Manager is already logged in no need to invite",
      });
    }

    if (user.expAt > currDate) {
      return res.status(400).json({
        success: false,
        message: "Resend window is only active after 7 day of invitation",
      });
    }
    user.expAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepo.save(user);

    const template = `
    <h1>Hello ${user.email} you are manager of the organization ${user.organizations.title}</h1>
    <h2>Given below your Email and default password</h2>
    <p>Change the password after first login</p>
    <p><strong>EMail: ${user.email}</strong></p>
    <p><strong>Password: ${user.password}</strong></p>
    <p>Login before 7 days otherwise the link will expire</p>
    `;
    await sendGrid(user.email, template);
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
