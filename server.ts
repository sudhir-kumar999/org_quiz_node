import express from "express";
import { AppDataSource } from "./src/config/data-source";
import dotenv from "dotenv"
import cors from 'cors';
import cookieParser from 'cookie-parser';
dotenv.config()
const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.get('/', (req, res) => {
  res.send('Hello World')
})
app.use(express.json());
app.use(cookieParser());


const PORT = process.env.PORT;
AppDataSource.initialize()
  .then(() => {
    console.log("Database Connected");

    app.listen(PORT, () => {
      console.log(
        `server is running at $ on port ${PORT}`,
      );
    });
  })
  .catch((err) => {
    console.log("DB ERROR");
    console.log(err);
  });
