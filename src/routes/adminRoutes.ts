import express from "express";
import { adminLogin, createOrg, getOrganizations, resendMail } from "../authController/adminController";
import { checkLogin } from '../middleware/checkLogin';
import { authorize } from '../authorization/authorize';
const adminRoute=express.Router();

adminRoute.post("/login",adminLogin);
adminRoute.post("/create-org",checkLogin,authorize("superadmin"),createOrg)
adminRoute.post("/resend",checkLogin,authorize("superadmin"),resendMail)
adminRoute.get("/organizations",checkLogin,authorize("superadmin"),getOrganizations)


export default adminRoute;