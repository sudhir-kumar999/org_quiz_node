import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity("superadmins")
export class Superadmin{
    @PrimaryGeneratedColumn('uuid')
    id!:string

    @Column()
    name!:string

    @Column()
    email!:string

    @Column()
    password!:string
}