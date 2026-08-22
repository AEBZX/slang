import {asm_args, asm_command, bin} from '../data'
export const BinMap=new Map([
    ['mov',0],
    ['add',4],
    ['sub',12],
    ['mul',20],
    ['div',28],
    ['mod',36],
    ['shr',44],
    ['shl',52],
    ['and',60],
    ['or',68],
    ['xor',76],
    ['load',84],
    ['cz',88],
    ['jz',92],
    ['tz',96],
    //1参
    ['call',100],
    ['jmp',102],
    ['thread',104],
    ['not',106],
    ['bit_not',108],
    //3参
    ['cmp',110],
    //1参
    ['push',118],
    ['pop',120],
    ['ret',122],
    //retn 原在 121 与 pop 的 value 槽位重叠,已挪到 169(delete 之后,避开 pop 区间)
    ['retn',169],
    //字符串索引 s[i]:独立操作码(offset_get 的字符串回退会与数组 owner 槽号数字碰撞误判)
    ['str_get',170],
    ['gc',123],
    //3参
    ['offset_set',124],
    ['offset_get',132],
    ['offset_addr',140],
    //2参
    ['in',148],
    ['out',152],
    ['block_start',156],
    ['block_end',158],
    ['param_set',159],
    ['param_load',163],
    //1参
    ['delete',167]
])
export const ParamOffset=new Map<string,number>([
    ['reg',0],
    ['value',1],
    ['regreg',0],
    ['regvalue',1],
    ['valuereg',2],
    ['valuevalue',3],
    ['regregreg',0],
    ['regregvalue',1],
    ['regvaluereg',2],
    ['regvaluevalue',3],
    ['valueregerg',4],
    ['valueregvalue',5],
    ['valuevaluereg',6],
    ['valuevaluevalue',7]
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
        return BinMap.get(this.id)+ParamOffset.get(one[0]+two[0])
    }
    generate_three(one:asm_args,two:asm_args,three:asm_args):number{
        return BinMap.get(this.id)+ParamOffset.get(one[0]+two[0]+three[0])
    }
    generate_one(data:asm_args):number{
        return BinMap.get(this.id)+ParamOffset.get(data[0])
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
    //is_func_call:0=块调用(if/while,压块帧),1=函数调用;retn 靠它弹到函数帧
    constructor(public target:asm_args,public cond:asm_args,public is_func_call:asm_args) {
        super('cz')
    }
    generate(): bin {
        return [super.generate_two(this.target,this.cond),this.target[1],this.cond[1],this.is_func_call[1]]
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
    //is_func_call:1=函数调用(压函数帧),0=块调用;retn 靠它弹到函数帧
    constructor(public target:asm_args,public is_func_call:asm_args) {
        super('call')
    }
    generate(): bin {
        return [super.generate_one(this.target),this.target[1],this.is_func_call[1],Null]
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
export class RETN extends IR{
    constructor() {
        super('retn')
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
export class STR_GET extends OFFSET_GET{
    constructor(target:asm_args,data:asm_args,offset:asm_args) {
        super(target,data,offset)
        this.id='str_get'
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
export class DELETE extends IR{
    constructor(public data:asm_args) {
        super('delete')
    }
    generate(): bin {
        return [super.generate_one(this.data),this.data[1],Null,Null]
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
    generate(): bin {
        return [super.generate_zero(),Null,Null,Null]
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