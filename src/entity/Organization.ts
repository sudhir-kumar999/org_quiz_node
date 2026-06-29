import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { User } from "./User";
import { Quiz } from "./Quiz";
import { Attempt_quiz } from "./Attempt_quiz";

@Entity("organizations")
export class Organization {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  title!: string;

  @Column()
  max_teacher!: number;

  @Column()
  max_student!: number;

  @Column({ default: "ACTIVE" })
  status!: string;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => User, (user) => user.organizations, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  created_by!: User;

  @OneToMany(() => User, (user) => user.organizations)
  users!: User[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "manager_id" })
  manager!: User;

  @OneToMany(() => Quiz, (quiz) => quiz.organization)
  quizzes!: Quiz[];

  @OneToMany(() => Attempt_quiz, (attempt) => attempt.organization)
  attempts!: Attempt_quiz[];
}
