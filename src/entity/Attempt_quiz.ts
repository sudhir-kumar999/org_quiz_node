import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Quiz } from "./Quiz";
import { Organization } from './Organization';

@Entity("attempt_quizzes")
export class Attempt_quiz{
    @PrimaryGeneratedColumn("uuid")
    id!:string

    @Column({type:"jsonb",default:[]})
    answer!:{
        Que_index:number
        selectedTF:boolean
        selectedoptions:number[]
    }[]

    @Column({default:0})
    obt_marks!:number

    @Column({default:false})
    isSubmitted!:boolean

    @CreateDateColumn()
    submitted_At!:Date

    @ManyToOne(()=>User,{onDelete:"CASCADE"})
    @JoinColumn({name:"student_id"})
    student!:User

    @ManyToOne(()=>Quiz,{onDelete:"CASCADE"})
    @JoinColumn({name:"quiz_id"})
    quiz!:Quiz

    @ManyToOne(()=>Organization,{onDelete:"CASCADE"})
    @JoinColumn({name:"org_id"})
    organization!:Organization
    
}