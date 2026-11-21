import {PeepholeTree} from '../lib/tool'
export const Null=0
export class IRTree extends PeepholeTree{}
export class IRArgs{
    public data:number
    public type:'reg'|'value'
    constructor(data:number,type:'reg'|'value') {
        this.data=data
        this.type=type
    }
    static reg(value:number){
        return new IRArgs(value,'reg')
    }
    static value(value:number){
        return new IRArgs(value,'value')
    }
}
export class MOV extends IRTree{
    constructor(public left:IRArgs,public right:IRArgs) {
        super()
    }
}
export class REF extends IRTree{
    constructor(public left:IRArgs,public right:IRArgs) {
        super()
    }
}
export class BINARY extends IRTree{
    constructor(public id:string,public result:IRArgs,public left:IRArgs,public right:IRArgs) {
        super()
    }
}
export class NOT extends IRTree{
    constructor(public left:IRArgs,public right:IRArgs) {
        super()
    }
}
export class BIT_NOT extends IRTree{
    constructor(public left:IRArgs,public right:IRArgs) {
        super()
    }
}
export class ControlStream extends IRTree{
    //frame=0:块帧,frame=1:函数帧
    constructor(public target:IRArgs,public frame:IRArgs) {
        super()
    }
}
export class ControlStreamCond extends ControlStream{
    constructor(target:IRArgs,frame:IRArgs,public cond:IRArgs) {
        super(target,frame)
    }
}
export class JZ extends ControlStreamCond{}
export class CZ extends ControlStreamCond{}
export class TZ extends ControlStreamCond{}
export class JMP extends ControlStream{}
export class CALL extends ControlStream{}
export class THREAD extends ControlStream{}
export class RET extends IRTree{
    constructor(public frame:IRArgs) {
        super()
    }
}
export class PUSH extends IRTree{
    constructor(public target:IRArgs) {
        super()
    }
}
export class POP extends IRTree{
    constructor() {
        super()
    }
}
export class OFFSET_SET extends IRTree{
    constructor(public target:IRArgs,public offset:IRArgs,public value:IRArgs) {
        super()
    }
}
export class OFFSET_GET extends IRTree{
    constructor(public target:IRArgs,public data:IRArgs,public offset:IRArgs) {
        super()
    }
}
export class IN extends IRTree{
    constructor(public oper:IRArgs,public target:IRArgs) {
        super()
    }
}
export class OUT extends IRTree{
    constructor(public oper:IRArgs,public target:IRArgs) {
        super()
    }
}
export class GC extends IRTree{
    constructor() {
        super()
    }
}
export class DELETE extends IRTree{
    constructor(public data:IRArgs) {
        super()
    }
}
export class PARAM_SET extends IRTree{
    constructor(public param:IRArgs,public value:IRArgs) {
        super()
    }
}
export class PARAM_LOAD extends IRTree{
    constructor(public data:IRArgs,public param:IRArgs) {
        super()
    }
}
export class INT_REGISTER extends IRTree{
    constructor(public block:IRArgs) {
        super()
    }
}
export class INT extends IRTree{
    constructor(public data:IRArgs) {
        super()
    }
}
export class INT_GET extends IRTree{
    constructor(public left:IRArgs) {
        super()
    }
}