import {asm_command, ASTTree} from '../data'
export type asm_tool={
    g:(ast:ASTTree)=>asm_command[],
    n:(r:string)=>number,
    p:(v:string|number)=>number,
    b:(v:string)=>number
}
export type asm_factory=(data:ASTTree,generate:(data:ASTTree)=>asm_command)=>asm_command
export class ASMFactory{
}