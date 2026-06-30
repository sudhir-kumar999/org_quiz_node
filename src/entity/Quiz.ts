import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User";
import { Organization } from "./Organization";
import { Attempt_quiz } from "./Attempt_quiz";
interface QuizQuestion {
  type: "true_false" | "multiple_choice";
  question: string;
  options?: string[];
  correctOptions: number[] | boolean;
  marks: number;
}
@Entity("quizzes")
export class Quiz {
  @PrimaryGeneratedColumn("uuid")
    id!: string;

  @Column()
    title!: string;

  @Column({ nullable: true })
    description!: string;

  @Column({
    type: "jsonb",
    default: [],
  })
  // questions!: {
  //   [x: string]:any;
  //   type: "true_false" | "multiple_choice"
  //   question: string;
  //   options: string[];
  //   correctOption: number;
  //   marks: number;
  // }[];
    questions!: QuizQuestion[];

  @Column({
    default: 0,
  })
    total_marks!: number;

  @Column({
    default: 0,
  })
    total_questions!: number;

  @Column({
    type: "timestamp",
  })
    start_date!: Date;

  @Column({
    type: "timestamp",
  })
    end_date!: Date;

  @Column({
    default: 30,
  })
    duration!: number; // minutes
  @Column({
    default: true,
  })
    is_active!: boolean;

  @CreateDateColumn()
    created_at!: Date;

  @ManyToOne(() => User, {
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "created_by",
  })
    created_by!: User;

  @ManyToOne(() => Organization, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "organization_id",
  })
    organization!: Organization;

  @OneToMany(()=>Attempt_quiz,(attempt)=>attempt.quiz)
    attempts!:Attempt_quiz[];
}