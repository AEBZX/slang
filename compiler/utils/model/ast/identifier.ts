import {ASTTree} from '../../data'
export class Type extends ASTTree{}
export class BasicType extends Type{}
export class LiteralType extends BasicType{}
export class NumberType extends LiteralType{}
export class BooleanType extends LiteralType{}
export class StringType extends LiteralType{}
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
    constructor(public local:string[],public generic:Type[],public _this:boolean=false){
        super()
    }
}
export class BlockType extends BasicType{
    constructor(public local:string[],public _this:boolean=false){
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
export class MapType extends FixType{}
export class PointType extends FixType{}