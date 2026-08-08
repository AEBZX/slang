import {asm_args} from '../data'
export class IR{
    constructor(public id:string) {
    }
}
export class MOV extends IR{
    constructor(public left:asm_args,public right:asm_args) {
        super('mov')
    }
}
export class LOAD extends IR{
    constructor(public reg:asm_args,public data:asm_args) {
        super('load')
    }
}
export class BINARY extends IR{
    constructor(id:string,public result:asm_args,public left:asm_args,public right:asm_args) {
        super(id)
    }
}
export class NOT extends IR{
    constructor(public data:asm_args) {
        super('not')
    }
}
export class BIT_NOT extends IR{
    constructor(public data:asm_args) {
        super('bit_not')
    }
}
export class CMP extends IR{
    constructor(public left:asm_args,public right:asm_args,public oper:asm_args) {
        super('cmp')
    }
}
export class JMP extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('jmp')
    }
}
export class CALL extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('call')
    }
}
export class THREAD extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('thread')
    }
}