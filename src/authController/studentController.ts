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
import { Attempt_quiz } from "../entity/Attempt_quiz";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userRepo = AppDataSource.getRepository(User);
const orgRepo = AppDataSource.getRepository(Organization);
const quizRepo = AppDataSource.getRepository(Quiz);
const attemptRepo = AppDataSource.getRepository(Attempt_quiz);
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
        role: "student",
      },
      relations: {
        organizations: true,
      },
    });
    console.log(teacher);
    if (!teacher) {
      return res.status(401).json({
        success: false,
        message: "Either you are not invited or you are not student",
      });
    }
    if (teacher.isBanned) {
      return res.status(400).json({
        success: false,
        message: "you are banned contact to your manager or teacher",
      });
    }

    const verify = await bcrypt.compare(password, teacher.password);
    if (!verify) {
      return res.status(401).json({
        success: false,
        message: "Wrong password entered",
      });
    }

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
    // console.log(payload)

    const accessToken = generateAccessToken(payload);
    // console.log(accessToken);

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
    console.log(token);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "logged in first with credential send on email",
      });
    }

    const decoded = (await verifyToken(token)) as decode;
    // console.log(decoded);
    if (!decoded) {
      return res.status(400).json({
        success: false,
        message: "invalid or token expired",
      });
    }
    console.log(decoded.id);
    console.log(decoded.role);
    const user = await userRepo.findOne({
      where: {
        id: decoded.id as string,
        role: decoded.role,
      },
    });
    // console.log("user", user);
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

export const getQuizzes = async (req: RequestWithRole, res: Response) => {
  try {
    const { org_id, id } = req.user!;
    console.log(org_id);
    if (!org_id || !id) {
      return res.status(400).json({
        status: false,
        message: "you are not involved in any organization or not logged in",
      });
    }
    const student = await userRepo.findOne({
      where: {
        id: id as string,
        role: "student",
      },
      relations: {
        invited_by: true,
      },
    });
    if (!student) {
      return res.status(400).json({
        status: false,
        message: "no user found logged in again",
      });
    }
    // console.log(student)
    const quizzes = await quizRepo.find({
      where: {
        organization: {
          id: org_id,
        },
        created_by: {
          id: student.invited_by.id,
        },
        is_active: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        start_date: true,
        end_date: true,
        duration: true,
        total_marks: true,
        total_questions: true,
      },
    });
    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No quizzes assigned.",
      });
    }

    console.log(quizzes);
    return res.status(200).json({
      success: true,
      message: "quiz fetched",
      data: quizzes,
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

export const getQuizzesDetails = async (
  req: RequestWithRole,
  res: Response,
) => {
  try {
    const { org_id, id } = req.user!;
    const { quiz_id } = req.params;
    // console.log(org_id)
    console.log(quiz_id);
    if (!org_id || !id) {
      return res.status(400).json({
        status: false,
        message: "you are not involved in any organization or not logged in",
      });
    }
    const student = await userRepo.findOne({
      where: {
        id: id as string,
        role: "student",
      },
      relations: {
        invited_by: true,
      },
    });
    if (!student) {
      return res.status(400).json({
        status: false,
        message: "no user found logged in again",
      });
    }
    const existing = await attemptRepo.findOne({
      where: {
        student: { id: student.id } as User,
        quiz: { id: quiz_id } as Quiz,
      },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "you already attempt this quiz",
      });
    }

    const quiz = await quizRepo.findOne({
      where: {
        id: quiz_id as string,
        organization: { id: org_id } as Organization,
        is_active: true,
      },
    });

    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz is not started" });
    }

    console.log(quiz);
    const now = new Date();
    if (now < quiz.start_date) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz not started " });
    }
    if (now > quiz.end_date) {
      return res.status(400).json({ success: false, message: "Quiz is ended" });
    }

    const safeQuestions = quiz.questions.map((q, index) => ({
      questionIndex: index,
      type: q.type,
      question: q.question,
      options: q.options ?? null,
      marks: q.marks,
    }));
    console.log(safeQuestions);

    return res.status(200).json({
      success: true,
      data: {
        duration: quiz.duration,
        total_questions: quiz.total_questions,
        total_marks: quiz.total_marks,
        questions: safeQuestions,
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

export const submitQuiz = async (req: RequestWithRole, res: Response) => {
  try {
    const { org_id, id } = req.user!;
    const { quiz_id } = req.params;
    const { answers } = req.body;

    if (!org_id || !id) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const student = await userRepo.findOne({
      where: {
        id: id as string,
        role: "student",
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const quiz = await quizRepo.findOne({
      where: {
        id: quiz_id as string,
        organization: {
          id: org_id,
        } as Organization,
        is_active: true,
      },
      relations: {
        organization: true,
      },
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    const now = new Date();

    if (now < quiz.start_date) {
      return res.status(400).json({
        success: false,
        message: "Quiz has not started",
      });
    }

    if (now > quiz.end_date) {
      return res.status(400).json({
        success: false,
        message: "Quiz has already ended",
      });
    }

    const alreadySubmitted = await attemptRepo.findOne({
      where: {
        quiz: { id: quiz.id },
        student: { id: student.id },
      },
    });

    if (alreadySubmitted) {
      return res.status(400).json({
        success: false,
        message: "Quiz already submitted.",
      });
    }

    const questions = quiz.questions;

    let score = 0;

    questions.forEach((question, index) => {
      const studentAnswer = answers[index];

      if (studentAnswer === undefined) return;

      switch (question.type) {
        case "multiple_choice": {
          if (!Array.isArray(question.correctOptions)) break;
          const correct = [...question.correctOptions].sort((a, b) => a - b);

          const student = [...(studentAnswer as number[])].sort(
            (a, b) => a - b,
          );

          const isCorrect =
            correct.length === student.length &&
            correct.every((value, i) => value === student[i]);

          if (isCorrect) {
            score += question.marks;
          }

          break;
        }

        case "true_false": {
          if (studentAnswer === question.correctOptions) {
            score += question.marks;
          }
          break;
        }
      }
    });

    const formattedAnswers = Object.entries(answers).map(([index, value]) => ({
      Que_index: Number(index),
      selectedTF: typeof value === "boolean" ? value : false,
      selectedoptions: Array.isArray(value) ? value : [],
    }));

    const attempt = attemptRepo.create({
      answer: formattedAnswers,
      obt_marks: score,
      isSubmitted: true,
      student,
      quiz,
      organization: quiz.organization,
    });

    await attemptRepo.save(attempt);

    return res.status(200).json({
      success: true,
      message: "Quiz submitted successfully.",
      score,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const getQuizResult = async (req: RequestWithRole, res: Response) => {
  try {
    const { id, org_id } = req.user!;
    const { quiz_id } = req.params;

    if (!id || !org_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized you are not login",
      });
    }

    const attempt = await attemptRepo.findOne({
      where: {
        student: { id: id as string },
        organization: { id: org_id } as Organization,
        quiz: { id: quiz_id as string },
      },
      relations: {
        quiz: true,
      },
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Result not found.",
      });
    }

    if (new Date() < attempt.quiz.end_date) {
      return res.status(403).json({
        success: false,
        message: "Result only available after the quiz end",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        quiz_id: attempt.quiz.id,
        score: attempt.obt_marks,
        total_marks: attempt.quiz.total_marks,
        submitted_at: attempt.submitted_At,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMyResults = async (req: RequestWithRole, res: Response) => {
  try {
    const { id, org_id } = req.user!;

    if (!id || !org_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const attempts = await attemptRepo.find({
      where: {
        student: {
          id: id as string,
        },
        organization: {
          id: org_id,
        } as Organization,
      },
      relations: {
        quiz: true,
      },
      order: {
        submitted_At: "DESC",
      },
    });

    if (attempts.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No quiz attempts found.",
      });
    }

    const now = new Date();

    const results = attempts.map((attempt) => ({
      quiz_id: attempt.quiz.id,
      title: attempt.quiz.title,
      total_marks: attempt.quiz.total_marks,
      score: now >= attempt.quiz.end_date ? attempt.obt_marks : null,
      submitted_at: attempt.submitted_At,
      end_date: attempt.quiz.end_date,
      result_published: now >= attempt.quiz.end_date,
    }));

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
