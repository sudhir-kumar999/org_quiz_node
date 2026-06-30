import express from "express";
import { getMe } from "../authController/getMe";
import { checkLogin } from "../middleware/checkLogin";
const getMeRouter=express.Router();

getMeRouter.get("/me",checkLogin,getMe);

export default getMeRouter;