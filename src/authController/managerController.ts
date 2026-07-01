import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import crypto from "crypto";
import { generateAccessToken, verifyToken } from "../utils/generateToken";
import bcrypt from "bcrypt";
import { Organization } from "../entity/Organization";
import { sendGrid } from "../utils/SendGrid";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userRepo = AppDataSource.getRepository(User);
const orgRepo = AppDataSource.getRepository(Organization);
import { In } from "typeorm";
interface decode {
  name: string;
  email: string;
  id: string | number;
  role: string;
  org_id: string;
}
interface RequestWithRole extends Request {
  user?: decode;
  org_id?: string;
}

export const firstLogin = async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    const { password } = req.body;
    if (!email || !password) {
      return res.status(401).json({
        success: false,
        message: "Email and Password  and name is required for login",
      });
    }
    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid email",
      });
    }
    const manager = await userRepo.findOne({
      where: {
        email,
        role: "manager",
      },
      relations: {
        organizations: true,
      },
    });
    if (!manager) {
      return res.status(401).json({
        success: false,
        message: "you are not a manager or not invited",
      });
    }
    if (manager.isDefPassUsed) {
      return res.status(400).json({
        success: false,
        message:
          "you are already logged in and change your password, try main login",
      });
    }
    const verify = await bcrypt.compare(password, manager.password);
    if (!verify) {
      return res.status(401).json({
        success: false,
        message: "wrong password",
      });
    }
    if (manager.expAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: "invite expire. contact superadmin",
      });
    }

    const payload = {
      name: manager.name,
      id: manager.id,
      email: manager.email,
      role: manager.role,
      org_id: manager.organizations.id,
    };
    const remainingTime = manager.expAt.getTime() - Date.now();
    const expiresIn = `${Math.floor(remainingTime / 1000)}s`;
    const tempToken = generateAccessToken(payload, expiresIn);

    res.clearCookie("tempToken");
    res.cookie("tempToken", tempToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: remainingTime,
    });
    return res.status(200).json({
      success: true,
      message: "change your password and login again",
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

export const chnagePassword = async (req: RequestWithRole, res: Response) => {
  try {
    let { name } = req.body;
    const { password } = req.body;
    const token = req.cookies.tempToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "logged in first with credential send on email",
      });
    }

    const decoded = (await verifyToken(token)) as decode;
    if (!decoded) {
      return res.status(400).json({
        success: false,
        message: "invalid or token expired",
      });
    }
    const user = await userRepo.findOne({
      where: {
        id: decoded.id as string,
        role: decoded.role,
      },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "You are not allowed to change password in manager route",
      });
    }
    if (user.isDefPassUsed) {
      return res.status(400).json({
        success: false,
        message: "you are already logged in and changed your password",
      });
    }

    if (user.expAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "invitation expire . Contact superadmin",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Enter 8 digit password",
      });
    }
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    name = name.trim();
    user.name = name;
    user.isDefPassUsed = true;
    await userRepo.save(user);
    res.clearCookie("tempToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    return res.status(200).json({
      success: true,
      message: " password changed success. Now you can log in",
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

export const login = async (req: Request, res: Response) => {
  try {
    let { email } = req.body;
    const { password } = req.body;
    if (!email || !password) {
      return res.status(401).json({
        success: false,
        message: "Email and Password  and name is required for login",
      });
    }
    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid email",
      });
    }

    const manager = await userRepo.findOne({
      where: {
        email,
        role: "manager",
      },
      relations: {
        organizations: true,
      },
    });
    if (!manager) {
      return res.status(401).json({
        success: false,
        message: "you are not manager or not invited",
      });
    }

    const verify = await bcrypt.compare(password, manager.password);
    if (!verify) {
      return res.status(401).json({
        success: false,
        message: "Wrong password entered",
      });
    }

    if (!manager.isDefPassUsed) {
      if (manager.expAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: "invite expired. contact superadmin",
        });
      }

      const payload = {
        name: manager.name,
        id: manager.id,
        email: manager.email,
        role: manager.role,
        org_id: manager.organizations.id,
      };

      const remainingTime = manager.expAt.getTime() - Date.now();
      const expiresIn = `${Math.floor(remainingTime / 1000)}s`;
      const tempToken = generateAccessToken(payload, expiresIn);
      res.cookie("tempToken", tempToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: remainingTime,
      });

      return res.status(200).json({
        success: true,
        firstLogin: true,
        tempToken,
        message: "Change your default password first",
      });
    }

    const payload = {
      name: manager.name,
      email: manager.email,
      id: manager.id,
      org_id: manager.organizations.id,
      role: manager.role,
    };
    const accessToken = generateAccessToken(payload);
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "login successfully",
      accessToken,
      data: {
        id: manager.id,
        email: manager.email,
        name: manager.name,
        role: manager.role,
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

export const teacherInvite = async (req: RequestWithRole, res: Response) => {
  try {
    let { email } = req.body;
    const org_id = req.user?.org_id as string;
    const id = req.user?.id;
    if (!email || !Array.isArray(email)) {
      return res.status(400).json({
        success: false,
        message: "provide email of teacher in array",
      });
    }
    const orgDetails = await orgRepo.findOne({
      where: {
        id: org_id,
      },
    });

    if (!orgDetails) {
      return res.status(401).json({
        success: false,
        message: "you are not a manager of any organization",
      });
    }

    const manager = await userRepo.findOne({
      where: {
        id: id as string,
        role: "manager",
      },
    });
    if (!manager) {
      return res.status(401).json({
        success: false,
        message: "you are not a manager of any organization",
      });
    }

    if (email.length > orgDetails.max_teacher) {
      return res.status(400).json({
        success: false,
        message: `You can invite only ${orgDetails.max_teacher} teacher`,
      });
    }

    const currTeacher = await userRepo.count({
      where: {
        role: "teacher",
        organizations: {
          id: org_id,
        },
      },
    });

    const remainingTeacher = orgDetails.max_teacher - currTeacher;

    if (email.length > remainingTeacher) {
      return res.status(400).json({
        success: false,
        message: ` ${remainingTeacher} invitation left`,
      });
    }

    const success = [];
    const failed = [];

    for (const emails of email) {
      email = emails.trim().toLowerCase();
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter valid email",
        });
      }

      const user = await userRepo.findOne({
        where: {
          email: emails,
        },
      });
      if (user) {
        failed.push(`${emails} is already added`);
        continue;
      }
      const defPassword = crypto.randomBytes(3).toString("hex");
      const hashDefPass = await bcrypt.hash(defPassword, 10);

      const teacherDetails = {
        email: email,
        password: hashDefPass,
        role: "teacher",
        isDefPassUsed: false,
        organizations: {
          id: orgDetails.id,
        },
        invited_by: manager,
        expAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      await userRepo.save(teacherDetails);
      const template = `
        <h1>Hello ${teacherDetails.email} you are teacher of the organization ${orgDetails.title}</h1>
        <h2>Given below your Email and default password</h2>
        <p>Change the password after first login</p>
        <p><strong>EMail: ${teacherDetails.email}</strong></p>
        <p><strong>Password: ${defPassword}</strong></p>
        <p>Login before 7 days otherwise the link will expire</p>
        <a href="https://quiz-portal-seven.vercel.app/auth/login">Click here</a>
        `;
      await sendGrid(teacherDetails.email, template);
      success.push(email);
    }
    res.status(200).json({
      success: true,
      message: "invitation mail send on teacher's mail",
      success_email: success,
      failedEmail: failed,
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

// export const reInvite = async (req: RequestWithRole, res: Response) => {
//   try {
//     let { email } = req.body;
//     const id = req.user;
//     const org_id = req.user;
//     console.log(Array.isArray(email));
//     if (!email || !Array.isArray(email)) {
//       return res.status(400).json({
//         success: false,
//         message: "provide email of teacher in array",
//       });
//     }

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "no user found. Login first",
//       });
//     }
//     const manager = await userRepo.findOne({
//       where: {
//         id: id.id as string,
//         role: "manager",
//       },
//     });
//     //   console.log(manager)
//     if (!manager) {
//       return res.status(400).json({
//         success: false,
//         message: "you are not a manager",
//       });
//     }
//     if (!org_id) {
//       return res.status(400).json({
//         success: false,
//         message: "no organization found",
//       });
//     }

//     const organization = await orgRepo.findOne({
//       where: {
//         id: org_id.org_id,
//       },
//     });

//     if (!organization) {
//       return res.status(400).json({
//         success: false,
//         message: "you are not involved in any organization",
//       });
//     }
//     //   console.log("organisation",organization)

//     const success = [];
//     const failed = [];
//     for (const emails of email) {
//       email = emails.trim().toLowerCase();
//       if (!emailRegex.test(email)) {
//         return res.status(400).json({
//           success: false,
//           message: "Please enter valid email",
//         });
//       }

//       const user = await userRepo.findOne({
//         where: {
//           email: emails,
//           role: In(["teacher", "user"]),
//         },
//       });
//       console.log("user", user);
//       if (user) {
//         if (user?.isDefPassUsed) {
//           failed.push(`${emails} is already logged in no need to invite`);
//           continue;
//         }

//         const currDate = new Date(Date.now());
//         console.log(currDate);
//         if (user.expAt > currDate) {
//           failed.push(
//             `${emails} Resend window is only active after 7 day of invitation`,
//           );
//           continue;
//         }

//         const defPassword = crypto.randomBytes(3).toString("hex");
//         const hashDefPass = await bcrypt.hash(defPassword, 10);
//         user.expAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
//         // await userRepo.save(user);
//         console.log("first");
//         user.password = hashDefPass;
//         await userRepo.save(user);
//         const template = `
//         <h1>Hello ${emails} you are manager of the organization ${org_id.org_id}</h1>
//         <h2>Given below your Email and default password</h2>
//         <p>Change the password after first login</p>
//         <p><strong>EMail: ${emails}</strong></p>
//         <p><strong>Password: ${defPassword}</strong></p>
//         <p>Login before 7 days otherwise the link will expire</p>
//         `;

//         const sendMail = await sendGrid(emails, template);
//         // console.log(sendMail);
//         success.push(emails);
//       }
//       if (!user) {
//         failed.push(`${emails} is not invited first`);
//         continue;
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: "invitation mail send on teacher's mail",
//       success_email: success,
//       failedEmail: failed,
//     });
//   } catch (error) {
//     if (error instanceof Error) {
//       res.status(500).json({
//         success: false,
//         message: error.message || "internal server error",
//       });
//     }
//   }
// };

export const reInvite = async (req: RequestWithRole, res: Response) => {
  try {
    let { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    email = email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    const managerId = req.user?.id;
    const organizationId = req.user?.org_id;
    if (!managerId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const manager = await userRepo.findOne({
      where: {
        id: managerId as string,
        role: "manager",
      },
    });

    if (!manager) {
      return res.status(403).json({
        success: false,
        message: "Only manager can re-invite teachers",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization not found",
      });
    }

    const organization = await orgRepo.findOne({
      where: {
        id: organizationId,
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    const user = await userRepo.findOne({
      where: {
        email,
        role: "teacher",
      },
      relations: {
        organizations: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User is not invited yet",
      });
    }

    if (user.organizations?.id !== organization.id) {
      return res.status(403).json({
        success: false,
        message: "User does not belong to your organization",
      });
    }

    if (user.isDefPassUsed) {
      return res.status(400).json({
        success: false,
        message: "User has already accepted the invitation",
      });
    }

    if (user.expAt > new Date()) {
      return res.status(400).json({
        success: false,
        message:
          "Re-invitation is allowed only after invitation expires (7 days)",
      });
    }

    const defaultPassword = crypto.randomBytes(3).toString("hex");
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    user.password = hashedPassword;
    user.expAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepo.save(user);
    const template = `
      <h1>Hello ${email}</h1>
      <p>Your invitation has been renewed for <strong>${organization.title}</strong>.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${defaultPassword}</p>
      <p>Please login and change your password.</p>
      <p>This invitation will expire after 7 days.</p>
        <a href="https://quiz-portal-seven.vercel.app/auth/login">Click here</a>
    `;

    await sendGrid(email, template);
    return res.status(200).json({
      success: true,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
export const teacherDetails = async (req: RequestWithRole, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No user found. Login first",
      });
    }
    const id = req.user;
    const org_id = req.user;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "no user found. Login first",
      });
    }
    const manager = await userRepo.findOne({
      where: {
        id: id.id as string,
        role: "manager",
      },
    });
    if (!manager) {
      return res.status(400).json({
        success: false,
        message: "you are not a manager",
      });
    }
    if (!org_id) {
      return res.status(400).json({
        success: false,
        message: "no organization found",
      });
    }

    const organization = await orgRepo.findOne({
      where: {
        id: org_id.org_id,
        manager: {
          id: manager.id,
        },
      },
    });
    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "you are not involved in any organization",
      });
    }
    const teacherData = await userRepo.find({
      where: {
        role: In(["teacher", "student"]),
        organizations: {
          id: org_id.org_id,
        },
      },
    });
    if (!teacherData) {
      return res.status(400).json({
        success: false,
        message: "no teacher found add the first",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher fetched successful",
      data: teacherData,
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

export const banUsers = async (req: RequestWithRole, res: Response) => {
  try {
    const { userId } = req.body;
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "No user found. Login first",
      });
    }

    const id = req.user;
    const org_id = req.user;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "no user found. Login first",
      });
    }
    const manager = await userRepo.findOne({
      where: {
        id: id.id as string,
        role: "manager",
      },
    });
    if (!manager) {
      return res.status(400).json({
        success: false,
        message: "you are not a manager",
      });
    }
    if (!org_id) {
      return res.status(400).json({
        success: false,
        message: "no organization found",
      });
    }

    const organization = await orgRepo.findOne({
      where: {
        id: org_id.org_id,
        manager: {
          id: manager.id,
        },
      },
    });
    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "you are not involved in any organization",
      });
    }

    const user = await userRepo.findOne({
      where: {
        id: userId,
        role: In(["teacher", "student"]),
        organizations: {
          id: org_id.org_id,
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Either no user found or You are only allowed to ban teacher and users",
      });
    }
    user.isBanned = !user.isBanned;
    await userRepo.save(user);
    return res.status(200).json({
      success: true,
      message: user.isBanned ? "user is banned" : "user is unbanned",
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
