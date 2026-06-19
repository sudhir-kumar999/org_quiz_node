import express from "express";
import { adminLogin, createOrg } from "../authController/adminController";
import { checkLogin } from '../middleware/checkLogin';
import { authorize } from '../authorization/authorize';
const adminRoute=express.Router();

adminRoute.post("/login",adminLogin);
adminRoute.post("/create-org",checkLogin,authorize("superadmin"),createOrg)

export default adminRoute;