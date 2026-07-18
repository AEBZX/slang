import {asm, asm_args, asm_command, asm_type, ast_data, bin, bin_command, TokenType} from '../data'
export class ASMFactory{
    visit:Map<string,(data:ast_data,factory:ASMFactory,asm:asm)=>void>
    constructor(){
        this.visit=new Map()
    }
    visitor(ast:ast_data){
        let asm:asm={
            code:new Map(),
            data:new Map(),
            pool:new Map()
        }
        this.visit.get(ast.type)(ast,this,asm)
        return asm
    }
}
export class BinFactory{
    block:(name:string,code:asm_command[],visit:(asm:asm_command)=>bin_command)=>bin_command[]
    command:Map<asm_type,(asm:asm_command)=>bin_command>
    constructor(block:(name:string,code:asm_command[])=>bin_command[]){
        this.block=block
        this.command=new Map()
    }
    register(name:asm_type,visitor:(asm:asm_command)=>bin_command){
        this.command.set(name, visitor)
    }
    generate(asm:asm):bin{
        let ret={
            bin:[],
            pool:asm.pool
        }
        let v=(asm:asm_command)=>{
            return this.command.get(asm.name)(asm)
        }
        let bin=[]
        for(let [name,code] of asm.code)
            bin.push(...this.block(name,code,v))
        ret.bin.push(...bin)
        return ret
    }
}
export default {
    asm:{
        visitor:(name:string,visitor:(data:ast_data,factory:ASMFactory,asm:asm)=>void)=>{return {name,visitor}},
        factory:(visit:{name:string,visitor:(data:ast_data,factory:ASMFactory,asm:asm)=>void}[])=>{
            let v=new ASMFactory()
            for(let i of visit)
                v.visit.set(i.name,i.visitor)
            return v
        }
    },
    bin:{
        factory:(name:asm_type,visitor:(asm:asm_command)=>bin_command)=>{
            return {name,visitor}
        },
        generate:(asm:asm,block:(name:string,code:asm_command[])=>bin_command[],factory:{name:asm_type,visitor:(asm:asm_command)=>bin_command}[])=>{
            let v=new BinFactory(block)
            for(let i of factory)
                v.register(i.name,i.visitor)
            return v.generate(asm)
        }
    }
}