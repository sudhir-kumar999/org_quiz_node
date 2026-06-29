import express from "express"
import { checkLogin } from '../middleware/checkLogin';
import { authorize } from '../authorization/authorize';
import { allQuizzes, banUsers, changePassword, createQuiz, login, reInvite, studentDetails, studentInvite } from "../authController/teacherController";
const teacherRoute=express.Router()

teacherRoute.post("/login",login)
teacherRoute.post("/change-password",changePassword)
teacherRoute.post("/invite",checkLogin,authorize("teacher"),studentInvite)
teacherRoute.post("/re-invite",checkLogin,authorize("teacher"),reInvite)
teacherRoute.get("/students-details",checkLogin,authorize("teacher"),studentDetails)
teacherRoute.post("/create-quiz",checkLogin,authorize("teacher"),createQuiz)
teacherRoute.get("/quizzes",checkLogin,authorize("teacher"),allQuizzes)
teacherRoute.post("/ban-users",checkLogin,authorize("teacher"),banUsers)

export default teacherRoute;