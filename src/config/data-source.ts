import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { Organization } from "../entity/Organization";
import { User } from "../entity/User";
import { Quiz } from "../entity/Quiz";
import { Attempt_quiz } from "../entity/Attempt_quiz";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL!,
  synchronize: true,
  logging: false,
  entities:[Organization,User,Quiz,Attempt_quiz]
});
