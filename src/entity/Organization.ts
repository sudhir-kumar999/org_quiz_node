import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { Superadmin } from "./Superadmin";
import { User } from './User';

@Entity("organizations")
export class Organization{
    @PrimaryGeneratedColumn('uuid')
      id!:string;

    @Column()
      title!:string;

    @Column()
      max_teacher!:number;

    @Column()
      max_student!:number;

    @Column({default:"ACTIVE"})
      status!:string

     @CreateDateColumn()
      created_at!:Date

    @ManyToOne(() => User, (user) => user.organizations,{ onDelete: "SET NULL" })
      @JoinColumn({ name: "created_by" })
      created_by!: User;

    @OneToMany(()=>User,(user)=>user.organizations)
    users!:User[]

    @ManyToOne(()=>User,{nullable:true})
    @JoinColumn({name:"manager_id"})
    manager!:User
}

