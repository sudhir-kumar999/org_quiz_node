import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Organization } from './Organization';

@Entity("superadmins")
export class Superadmin{
    @PrimaryGeneratedColumn()
      id!:number;

    @Column()
      name!:string;

    @Column({unique:true})
      email!:string;

    @Column()
      password!:string;

    @Column({default:"superadmin"})
      role!:string;
     
    // @OneToMany(()=>Organization,(organization)=>organization.superadmin)
    // organization!:Organization[]


}


