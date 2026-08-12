import {asm_args, asm_command, bin} from '../data'
export const BinMap=new Map([
    //占用4个单位
    ['mov',0],
    ['add',8],
    ['sub',16],
    ['mul',24],
    ['div',32],
    ['mod',40],
    ['shr',48],
    ['shl',56],
    ['and',64],
    ['or',72],
    ['xor',80],
    ['load',88],
    ['cz',90],
    ['jz',94],
    ['tz',98],
    ['in',102],
    ['out',104],
    ['offset_set',108],
    ['offset_get',116],
    ['offset_addr',163],
    ['cmp',124],
    ['push',132],
    ['pop',140],
    ['ret',142],
    ['gc',143],
    ['not',144],
    ['bit_not',146],
    //无条件跳
    ['jmp',147],
    ['call',149],
    ['thread',151],
    ['block_start',153],
    ['block_end',154],
    ['param_set',155],
    ['param_load',159]
])
export const ParamOffset=new Map([
    [['reg','reg'],0],
    [['reg','value'],1],
    [['value','reg'],2],
    [['value','value'],3],
    [['reg','reg','reg'],0],
    [['reg','reg','value'],1],
    [['reg','value','reg'],2],
    [['reg','value','value'],3],
    [['value','reg','reg'],4],
    [['value','reg','value'],5],
    [['value','value','reg'],6],
    [['value','value','value'],7]
])
export const Null=0
export class IR{
    constructor(public id:string) {
    }
    static isNumber(data:asm_args){
        return data[0]=='reg'
    }
    generate():bin{
        return null
    }
    generate_two(one:asm_args,two:asm_args):number{
        return BinMap.get(this.id)+ParamOffset.get([one[0],two[0]])
    }
    generate_three(one:asm_args,two:asm_args,three:asm_args):number{
        return BinMap.get(this.id)+ParamOffset.get([one[0],two[0],three[0]])
    }
    generate_one(data:asm_args):number{
        return BinMap.get(this.id)+ParamOffset.get([data[0]])
    }
    generate_zero():number{
        return BinMap.get(this.id)
    }
}
export class MOV extends IR{
    constructor(public left:asm_args,public right:asm_args) {
        super('mov')
    }
    generate():bin{
        return [super.generate_two(this.left,this.right),this.left[1],this.right[1],Null]
    }
}
export class LOAD extends IR{
    constructor(public reg:asm_args,public data:asm_args) {
        super('load')
    }
    generate():bin{
        return [super.generate_two(this.reg,this.data),this.reg[1],this.data[1],Null]
    }
}
export class BINARY extends IR{
    constructor(id:string,public result:asm_args,public left:asm_args,public right:asm_args) {
        super(id)
    }
    generate(): bin {
        return [super.generate_two(this.left,this.right),this.result[1],this.left[1],this.right[1]]
    }
}
export class NOT extends IR{
    constructor(public data:asm_args) {
        super('not')
    }
    generate(): bin {
        return [super.generate_zero(),this.data[1],Null,Null]
    }
}
export class BIT_NOT extends IR{
    constructor(public data:asm_args) {
        super('bit_not')
    }
    generate(): bin {
        return [super.generate_zero(),this.data[1],Null,Null]
    }
}
export class CMP extends IR{
    constructor(public left:asm_args,public right:asm_args,public oper:asm_args) {
        super('cmp')
    }
    generate(): bin {
        return [super.generate_three(this.left,this.right,this.oper),this.left[1],this.right[1],this.oper[1]]
    }
}
export class JZ extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('jz')
    }
    generate(): bin {
        return [super.generate_two(this.target,this.cond),this.target[1],this.cond[1],Null]
    }
}
export class CZ extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('cz')
    }
    generate(): bin {
        return [super.generate_two(this.target,this.cond),this.target[1],this.cond[1],Null]
    }
}
export class TZ extends IR{
    constructor(public target:asm_args,public cond:asm_args) {
        super('tz')
    }
    generate(): bin {
        return [super.generate_two(this.target,this.cond),this.target[1],this.cond[1],Null]
    }
}
export class JMP extends IR{
    constructor(public target:asm_args) {
        super('jmp')
    }
    generate(): bin {
        return [super.generate_one(this.target),this.target[1],Null,Null]
    }
}
export class CALL extends IR{
    constructor(public target:asm_args) {
        super('call')
    }
    generate(): bin {
        return [super.generate_one(this.target),this.target[1],Null,Null]
    }
}
export class THREAD extends IR{
    constructor(public target:asm_args) {
        super('thread')
    }
    generate(): bin {
        return [super.generate_one(this.target),this.target[1],Null,Null]
    }
}
export class RET extends IR{
    constructor() {
        super('ret')
    }
    generate(): bin {
        return [super.generate_zero(),Null,Null,Null]
    }
}
export class PUSH extends IR{
    constructor(public target:asm_args) {
        super('push')
    }
    generate(): bin {
        return [super.generate_zero(),this.target[1],Null,Null]
    }
}
export class POP extends IR{
    constructor(public target:asm_args) {
        super('pop')
    }
    generate(): bin {
        return [super.generate_zero(),this.target[1],Null,Null]
    }
}
export class OFFSET_SET extends IR{
    constructor(public target:asm_args,public offset:asm_args,public value:asm_args) {
        super('offset_set')
    }
    generate(): bin {
        return [super.generate_three(this.target,this.offset,this.value),this.target[1],this.offset[1],this.value[1]]
    }
}
export class OFFSET_GET extends IR{
    constructor(public target:asm_args,public data:asm_args,public offset:asm_args) {
        super('offset_get')
    }
    generate(): bin {
        return [super.generate_three(this.target,this.data,this.offset),this.target[1],this.data[1],this.offset[1]]
    }
}
export class OFFSET_ADDR extends IR{
    constructor(public target:asm_args,public data:asm_args,public offset:asm_args) {
        super('offset_addr')
    }
    generate(): bin {
        return [super.generate_three(this.target,this.data,this.offset),this.target[1],this.data[1],this.offset[1]]
    }
}
export class IN extends IR{
    constructor(public oper:asm_args,public data:asm_args) {
        super('in')
    }
    generate(): bin {
        return [super.generate_two(this.oper,this.data),this.oper[1],this.data[1],Null]
    }
}
export class OUT extends IR{
    constructor(public oper:asm_args,public target:asm_args) {
        super('out')
    }
    generate(): bin {
        return [super.generate_two(this.oper,this.target),this.oper[1],this.target[1],Null]
    }
}
export class GC extends IR{
    constructor() {
        super('gc')
    }
    generate(): bin {
        return [super.generate_zero(),Null,Null,Null]
    }
}
export class BLOCK_START extends IR{
    constructor(public name:asm_args) {
        super('block_start')
    }
    generate(): bin {
        return [super.generate_zero(),this.name[1],Null,Null]
    }
}
export class BLOCK_END extends IR{
    constructor() {
        super('block_end')
    }

}
export class PARAM_SET extends IR{
    constructor(public param:asm_args,public value:asm_args) {
        super('param_set')
    }
    generate(): bin {
        return [super.generate_two(this.param,this.value),this.param[1],this.value[1],Null]
    }
}
export class PARAM_LOAD extends IR{
    constructor(public data:asm_args,public param:asm_args) {
        super('param_load')
    }
    generate(): bin {
        return [super.generate_two(this.data,this.param),this.data[1],this.param[1],Null]
    }
}