import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import { Organization } from "../entity/Organization";
import { generateAccessToken, verifyToken } from "../utils/generateToken";
import bcrypt from "bcrypt";
import { sendGrid } from "../utils/SendGrid";
import crypto from "crypto";
import { In } from "typeorm";
import { Quiz } from "../entity/Quiz";
import csv from "csv-parser";
import { Readable } from "stream";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userRepo = AppDataSource.getRepository(User);
const orgRepo = AppDataSource.getRepository(Organization);
const quizRepo = AppDataSource.getRepository(Quiz);
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

    const teacher = await userRepo.findOne({
      where: {
        email,
        role: "teacher",
      },
      relations: {
        organizations: true,
      },
    });
    if (!teacher) {
      return res.status(401).json({
        success: false,
        message: "Either you are not invited or you are not manager",
      });
    }

    if (teacher.isBanned) {
      return res.status(400).json({
        success: false,
        message: "you are banned contact to your manager",
      });
    }

    // if (!manager.isDefPassUsed) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "logged in first with your credential send on email and change password the try login",
    //   });
    // }

    const verify = await bcrypt.compare(password, teacher.password);
    if (!verify) {
      return res.status(401).json({
        success: false,
        message: "Wrong password entered",
      });
    }

    // if (teacher.isDefPassUsed) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "you are already changed your password, try login",
    //   });
    // }

    if (!teacher.isDefPassUsed) {
      if (teacher.expAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: "invite expired. contact superadmin",
        });
      }

      const payload = {
        name: teacher.name,
        id: teacher.id,
        email: teacher.email,
        role: teacher.role,
        org_id: teacher.organizations.id,
      };

      const remainingTime = teacher.expAt.getTime() - Date.now();
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
      name: teacher.name,
      email: teacher.email,
      id: teacher.id,
      org_id: teacher.organizations.id,
      role: teacher.role,
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
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
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

export const changePassword = async (req: Request, res: Response) => {
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
      return res.status(200).json({
        success: false,
        message: "Enter 8 digit password",
      });
    }
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    name = name?.trim();
    user.name = name;
    user.isDefPassUsed = true;
    await userRepo.save(user);

    res.clearCookie("tempToken");
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

export const studentInvite = async (req: RequestWithRole, res: Response) => {
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

    const teacher = await userRepo.findOne({
      where: {
        id: id as string,
        role: "teacher",
      },
    });
    if (!teacher) {
      return res.status(401).json({
        success: false,
        message: "you are not a manager of any organization",
      });
    }

    if (email.length > orgDetails.max_student) {
      return res.status(400).json({
        success: false,
        message: `You can invite only ${orgDetails.max_student} teacher`,
      });
    }

    const currStudent = await userRepo.count({
      where: {
        role: "student",
        organizations: {
          id: org_id,
        },
      },
    });
    const remainingStudent = orgDetails.max_student - currStudent;

    if (email.length > remainingStudent) {
      return res.status(400).json({
        success: false,
        message: ` ${remainingStudent} invitation left`,
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
          organizations: {
            id: org_id,
          },
        },
      });
      if (user) {
        failed.push(`${emails} is already added`);
        continue;
      }
      const defPassword = crypto.randomBytes(3).toString("hex");
      const hashDefPass = await bcrypt.hash(defPassword, 10);

      const studentDetails = {
        email: email,
        password: hashDefPass,
        role: "student",
        organizations: {
          id: orgDetails.id,
        },
        invited_by: teacher,
        expAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      await userRepo.save(studentDetails);
      const template = `
        <h1>Hello ${studentDetails.email} you are student of the organization ${orgDetails.title}</h1>
        <h2>Given below your Email and default password</h2>
        <p>Change the password after first login</p>
        <p><strong>EMail: ${studentDetails.email}</strong></p>
        <p><strong>Password: ${defPassword}</strong></p>
        <p>Login before 7 days otherwise the link will expire</p>
        <a href="https://quiz-portal-seven.vercel.app/auth/login">Click here</a>
        `;

      await sendGrid(studentDetails.email, template);
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

export const reInvite = async (req: RequestWithRole, res: Response) => {
  try {
    let { email } = req.body;
    const id = req.user;
    const org_id = req.user;
    if (!email || !Array.isArray(email)) {
      return res.status(400).json({
        success: false,
        message: "provide email of teacher in array",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "no user found. Login first",
      });
    }
    const teacher = await userRepo.findOne({
      where: {
        id: id.id as string,
        role: "teacher",
      },
    });
    if (!teacher) {
      return res.status(400).json({
        success: false,
        message: "you are not a teacher",
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
      },
    });

    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "you are not involved in any organization",
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
          role: In(["student"]),
        },
      });
      if (user) {
        if (user?.isDefPassUsed) {
          failed.push(`${emails} is already logged in no need to invite`);
          continue;
        }

        const currDate = new Date(Date.now());
        if (user.expAt > currDate) {
          failed.push(
            `${emails} Resend window is only active after 7 day of invitation`,
          );
          continue;
        }

        const defPassword = crypto.randomBytes(3).toString("hex");
        const hashDefPass = await bcrypt.hash(defPassword, 10);
        user.expAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        user.password = hashDefPass;
        await userRepo.save(user);
        const template = `
        <h1>Hello ${emails} you are student of the organization ${org_id.org_id}</h1>
        <h2>Given below your Email and default password</h2>
        <p>Change the password after first login</p>
        <p><strong>EMail: ${emails}</strong></p>
        <p><strong>Password: ${defPassword}</strong></p>
        <p>Login before 7 days otherwise the link will expire</p>
        <a href="https://quiz-portal-seven.vercel.app/auth/login">Click here</a>
        `;

        await sendGrid(emails, template);
        success.push(emails);
      }
      if (!user) {
        failed.push(
          `${emails} is not invited or you have assigned some other role`,
        );
        continue;
      }
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

export const studentDetails = async (req: RequestWithRole, res: Response) => {
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
        role: "teacher",
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
        users: {
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
        role: "student",
        organizations: {
          id: organization.id,
        },
        invited_by: {
          id: manager.id,
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

export const createQuiz = async (req: RequestWithRole, res: Response) => {
  try {
    const { id, org_id } = req.user!;

    if (!id || !org_id) {
      return res.status(400).json({
        success: false,
        message: "Token not found",
      });
    }

    const { title, description, questions, start_date, end_date, duration } =
      req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "start_date and end_date are required",
      });
    }

    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: "end date is greater than start date",
      });
    }

    if (new Date(start_date) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "start date cannot be in past",
      });
    }

    if (!duration || typeof duration !== "number" || duration < 1) {
      return res.status(400).json({
        success: false,
        message: "give duration in min",
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum 1 question is required",
      });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = i + 1;

      if (!q.type || !["true_false", "multiple_choice"].includes(q.type)) {
        return res.status(400).json({
          success: false,
          message: `Question ${qNum}: type must be true_false or multiple_choice`,
        });
      }

      if (!q.question || q.question.trim() === "") {
        return res.status(400).json({
          success: false,
          message: `Question ${qNum}: question text is required`,
        });
      }

      if (!q.marks || typeof q.marks !== "number" || q.marks < 1) {
        return res.status(400).json({
          success: false,
          message: `Question ${qNum}:marks is required and cannot be less than 0`,
        });
      }

      if (q.type === "true_false") {
        if (typeof q.correctOptions !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `Question ${qNum}: in true false correct option must be true or false `,
          });
        }
      }

      if (q.type === "multiple_choice") {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          return res.status(400).json({
            success: false,
            message: `Question ${qNum}: minimum 2 options is required`,
          });
        }

        if (
          !q.correctOptions ||
          !Array.isArray(q.correctOptions) ||
          q.correctOptions.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: `Question ${qNum}: correctOptions array is required`,
          });
        }

        for (const idx of q.correctOptions) {
          if (idx < 0 || idx >= q.options.length) {
            return res.status(400).json({
              success: false,
              message: `Question ${qNum}: correctOption index ${idx} is required`,
            });
          }
        }
      }
    }

    const teacher = await userRepo.findOne({
      where: {
        id: id as string,
        role: "teacher",
        organizations: { id: org_id as string },
      },
      relations: {
        organizations: true,
      },
    });

    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: "Teacher not found in this organization",
      });
    }

    const total_marks = questions.reduce((sum: number, q) => sum + q.marks, 0);
    const quiz = quizRepo.create({
      title: title.trim(),
      description: description?.trim() || null,
      questions,
      total_marks,
      total_questions: questions.length,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      duration,
      created_by: teacher,
      organization: { id: org_id },
    });

    await quizRepo.save(quiz);
    return res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: quiz,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
};

export const allQuizzes = async (req: RequestWithRole, res: Response) => {
  try {
    const { id, org_id } = req.user!;
    if (!id || !org_id) {
      return res.status(400).json({
        success: false,
        message: "Token is not valid",
      });
    }
    const teacher = await userRepo.findOne({
      where: {
        id: id as string,
        role: "teacher",
        organizations: { id: org_id as string },
      },
      relations: {
        organizations: true,
      },
    });

    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: "Teacher not found in this organization",
      });
    }
    const org = await orgRepo.findOne({
      where: {
        id: org_id,
      },
    });
    if (!org) {
      return res.status(403).json({
        success: false,
        message: "no org found in this organization",
      });
    }
    const quizzes = await quizRepo.find({
      where: {
        created_by: { id: teacher.id as string } as User,
        organization: {
          id: org.id as string,
        } as Organization,
      },
      relations: {
        organization: true,
        created_by: true,
      },
    });

    if (!quizzes) {
      return res.status(403).json({
        success: false,
        message: "quizzes not found in this organization",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Quizzes fetched successfully",
      data: quizzes,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
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
    const teacher = await userRepo.findOne({
      where: {
        id: id.id as string,
        role: "teacher",
      },
    });
    if (!teacher) {
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
        role: "student",
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

export const uploadCsv=async(req:RequestWithRole,res:Response)=>{
  try {
    const column:string=req.body.column;
    const formData=req.file;
    if(!formData){
      return; 
    }
    if(!column){
      return; 
    }
    type RowData = {
  "Login email": string,
    Identifier: string,
    "First name": string,
    "Last name": string
};
    const results: RowData[]=[];
    const emailData:string[]=[];
    await new Promise<void>((resolve, reject) => {
      Readable.from(formData.buffer)
        .pipe(csv({ separator: ";" }))
        .on("data", (data) => results.push(data))
        .on("end", () => {
          results.forEach((ele) => {
            emailData.push(ele[column as keyof RowData]);
          });
          resolve();
        })
        .on("error", reject);
    });
 
    if(emailData.length==0){
      return res.status(400).json({
        success:false,
        message:"No email found inside csv or column name is wrong"
      });
    }

    const email=emailData;
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

    const teacher = await userRepo.findOne({
      where: {
        id: id as string,
        role: "teacher",
      },
    });
    if (!teacher) {
      return res.status(401).json({
        success: false,
        message: "you are not a manager of any organization",
      });
    }

    if (email.length > orgDetails.max_student) {
      return res.status(400).json({
        success: false,
        message: `You can invite only ${orgDetails.max_student} teacher`,
      });
    }

    const currStudent = await userRepo.count({
      where: {
        role: "student",
        organizations: {
          id: org_id,
        },
      },
    });

    const remainingStudent = orgDetails.max_student - currStudent;
    if (email.length > remainingStudent) {
      return res.status(400).json({
        success: false,
        message: ` ${remainingStudent} invitation left`,
      });
    }

    const success = [];
    const failed = [];

    for (const emails of email) {
      if(!emails){
        return res.status(400).json({
          success:false,
          message:"No email found inside csv or column name is wrong"
        });
      }
      const newEmail=emails.trim().toLowerCase();
      
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter valid email",
        });
      }

      const user = await userRepo.findOne({
        where: {
          email: emails,
          organizations: {
            id: org_id,
          },
        },
      });
      if (user) {
        failed.push(`${emails} is already added`);
        continue;
      }
      const defPassword = crypto.randomBytes(3).toString("hex");
      const hashDefPass = await bcrypt.hash(defPassword, 10);

      const studentDetails = {
        email: newEmail,
        password: hashDefPass,
        role: "student",
        organizations: {
          id: orgDetails.id,
        },
        invited_by: teacher,
        expAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      await userRepo.save(studentDetails);
      const template = `
        <h1>Hello ${studentDetails.email} you are student of the organization ${orgDetails.title}</h1>
        <h2>Given below your Email and default password</h2>
        <p>Change the password after first login</p>
        <p><strong>EMail: ${studentDetails.email}</strong></p>
        <p><strong>Password: ${defPassword}</strong></p>
        <p>Login before 7 days otherwise the link will expire</p>
        <a href="https://quiz-portal-seven.vercel.app/auth/login">Click here</a>
        `;

      await sendGrid(studentDetails.email, template);
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