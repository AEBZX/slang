import {HIRTree} from '../../data'
import {HCommand} from './command'
export class HExpr extends HIRTree{}
export class HPrimaryExpr extends HExpr{}
export class HLiteral extends HPrimaryExpr{}
export class HNumberLiteral extends HLiteral{
    constructor(public value:number) {
        super()
    }
}
export class HStringLiteral extends HLiteral{
    constructor(public value:string) {
        super()
    }
}
export class HBooleanLiteral extends HLiteral{
    constructor(public value:boolean) {
        super()
    }
}
export class HNullLiteral extends HLiteral{}
export class HIdentifierExpr extends HPrimaryExpr{
    constructor(public name:number) {
        super()
    }
}
export class HArrayExpr extends HPrimaryExpr{
    constructor(public elements:HExpr[]) {
        super()
    }
}
export class HMapExpr extends HPrimaryExpr{
    constructor(public elements:Map<string,HExpr>) {
        super()
    }
}
export class HLambdaExpr extends HPrimaryExpr{
    constructor(public params:number[],public commands:HCommand) {
        super()
    }
}
export class HFixExpr extends HExpr{}
export class HIndexExpr extends HFixExpr{
    constructor(public target:HExpr,public index:HExpr) {
        super()
    }
}
export class HMemberExpr extends HFixExpr{
    constructor(public target:HExpr,public member:HExpr) {
        super()
    }
}
export class HPostIncrementExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HPostDecrementExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HPreIncrementExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HPreDecrementExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HArgumentsExpr extends HFixExpr{
    constructor(public target:HExpr,public args:HExpr[]) {
        super()
    }
}
//new 表达式:对象分配+this参数传递(此前 NewPrefix 被忽略,new 降级为普通调用,无对象)
export class HNewExpr extends HExpr{
    constructor(public target:HExpr,public args:HExpr[]) {
        super()
    }
}
export class HNotExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HBitNotExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HMinusExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HReferenceExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HAddressExpr extends HFixExpr{
    constructor(public target:HExpr) {
        super()
    }
}
export class HBinaryExpr extends HExpr{
    constructor(public left:HExpr,public op:string,public right:HExpr) {
        super()
    }
}
export class HTernaryExpr extends HExpr{
    constructor(public condition:HExpr,public trueExpr:HExpr,public falseExpr:HExpr) {
        super()
    }
}