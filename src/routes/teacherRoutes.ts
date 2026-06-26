import express from "express"
import { checkLogin } from '../middleware/checkLogin';
import { authorize } from '../authorization/authorize';
import { changePassword, login, reInvite, studentDetails, studentInvite } from "../authController/teacherController";
const teacherRoute=express.Router()

teacherRoute.post("/login",login)
teacherRoute.post("/change-password",changePassword)
teacherRoute.post("/invite",checkLogin,authorize("teacher"),studentInvite)
teacherRoute.post("/re-invite",checkLogin,authorize("teacher"),reInvite)
teacherRoute.get("/students-details",checkLogin,authorize("teacher"),studentDetails)

export default teacherRoute;