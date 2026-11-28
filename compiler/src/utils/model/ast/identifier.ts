import {ASTTree} from '../../data'
import {Block} from './block'
export class Type extends ASTTree{}
export class BasicType extends Type{}
export class LiteralType extends BasicType{}
export class NumberType extends LiteralType{}
export class BooleanType extends LiteralType{}
export class VoidType extends BasicType{}
export class GenericType extends BasicType{
    constructor(public generic:string){
        super()
    }
}
export class LambdaType extends BasicType{
    constructor(public generic:Map<string,Type>,public params:Map<string,Type>,public returnType:Type
                ,public overload:boolean=false,public name:string=''){
        super()
    }
}
export class ClassType extends BasicType{
    constructor(public local:string[],public field:Block[]=[]){
        super()
    }
}
export class BlockType extends BasicType{
    constructor(public local:string[],public field:Block[]=[]){
        super()
    }
}
export class EnumType extends BasicType{
    constructor(public local:string[]){
        super()
    }
}
export class FixType extends Type{
    constructor(public t:Type){
        super()
    }
}
export class ArrayType extends FixType{}
export class PointType extends FixType{}
export class ReferenceType extends FixType{
    //literal:是不是identifier,call,identifier就是无需特殊处理的左值,call就是需要特殊处理的左值(比如返回引用的函数)
    constructor(t:Type,public literal:'identifier'|'call'='call') {
        super(t)
    }

}