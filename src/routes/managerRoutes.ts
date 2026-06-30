import express from "express";
import { banUsers, chnagePassword, firstLogin, login, reInvite, teacherDetails, teacherInvite } from "../authController/managerController";
import { checkLogin } from "../middleware/checkLogin";
import { authorize } from "../authorization/authorize";
const managerRoute=express.Router();

managerRoute.post("/first-login",firstLogin);
managerRoute.post("/reset-password",chnagePassword);
managerRoute.post("/login",login);
managerRoute.post("/invite",checkLogin,authorize("manager"),teacherInvite);
managerRoute.post("/re-invite",checkLogin,authorize("manager"),reInvite);
managerRoute.get("/teacher-details",checkLogin,authorize("manager"),teacherDetails);
managerRoute.post("/ban-users",checkLogin,authorize("manager"),banUsers);

export default managerRoute;