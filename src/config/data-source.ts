import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { Organization } from "../entity/Organization";
import { User } from "../entity/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL!,
  synchronize: true,
  logging: false,
  entities:[Organization,User]
});
