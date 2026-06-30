import express from "express";
import { checkLogin } from "../middleware/checkLogin";
import { authorize } from "../authorization/authorize";
import { changePassword, getMyResults, getQuizResult, getQuizzes, getQuizzesDetails, login, submitQuiz } from "../authController/studentController";
const studentRoute=express.Router();

studentRoute.post("/login",login);
studentRoute.post("/change-password",changePassword);
studentRoute.get("/get-quiz",checkLogin,authorize("student"),getQuizzes);
studentRoute.get("/getquiz/:quiz_id",checkLogin,authorize("student"),getQuizzesDetails);
studentRoute.post("/submitquiz/:quiz_id",checkLogin,authorize("student"),submitQuiz);
studentRoute.get("/quizzes/:quiz_id/result",checkLogin,authorize("student"),getQuizResult);
studentRoute.get("/results",checkLogin,authorize("student"),getMyResults
);
export default studentRoute;