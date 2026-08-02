import {ASTTree} from '../data'
export class TypeFix{}
export class ArrayFix extends TypeFix{}
export class MapFix extends TypeFix{}
export class PointFix extends TypeFix{}
export class Type extends ASTTree{}
export class BasicType extends Type{}
export class LiteralType extends BasicType{}
export class NumberType extends LiteralType{}
export class BooleanType extends LiteralType{}
export class StringType extends LiteralType{}
export class VoidType extends BasicType{}
export class LambdaType extends BasicType{
    constructor(public params:Map<string,Type>,public returnType:Type){
        super()
    }
}
export class ClassType extends BasicType{
    constructor(public local:string[]){
        super()
    }
}
export class FixType extends Type{
    constructor(public t:BasicType,public fix:TypeFix[]){
        super()
    }
}