import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Organization } from "./Organization";

@Entity("users")
export class User{
    @PrimaryGeneratedColumn('uuid')
      id!:string

    @Column({nullable :true})
      name!:string

    @Column()
      email!:string

    @Column()
      password!:string 

    @Column()
      role!:string

    @Column({default:false})
      isBanned!:boolean

    @Column({default:false})
      isDefPassUsed!:boolean

    @CreateDateColumn()
      created_at!:Date

    @Column({nullable :true})
    expAt!: Date;

    @ManyToOne(() => Organization,(organization)=>organization.users,{ onDelete: "SET NULL" })
    @JoinColumn({ name: "org_id" })
      organizations!: Organization;

    @ManyToOne (()=>User,{nullable :true})
    @JoinColumn ({name:'invited_by'})
      invited_by!:User

}