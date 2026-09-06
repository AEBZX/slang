import {ASTTree} from '../../data'
import {Type} from './identifier'
import {Command} from './command'
export class Expression extends ASTTree{}
export class PrimaryExpression extends Expression{}
export class Literal extends PrimaryExpression{
    constructor(public value:string) {
        super()
    }
}
export class NumberLiteral extends Literal{}
export class StringLiteral extends Literal{}
export class BooleanLiteral extends Literal{}
export class NullLiteral extends Literal{}
export class IdentifierExpr extends PrimaryExpression{
    constructor(public name:string) {
        super()
    }
}
export class ArrayExpression extends PrimaryExpression{
    constructor(public elements:Expression[]) {
        super()
    }
}
export class MapExpression extends PrimaryExpression{
    constructor(public elements:Map<string,Expression>) {
        super()
    }
}
export class LambdaExpression extends PrimaryExpression{
    constructor(public generic:Map<string,Type>,public params:Map<string,Type>,public ret:Type,public body:Command) {
        super()
    }
}
export class Postfix{}
export class IncrementPostfix extends Postfix{}
export class DecrementPostfix extends Postfix{}
export class MemberPostfix extends Postfix{
    constructor(public name:string) {
        super()
    }
}
export class IndexPostfix extends Postfix{
    constructor(public index:Expression) {
        super()
    }
}
export class ArgumentsPostfix extends Postfix{
    constructor(public generic:Type[],public args:Expression[]) {
        super()
    }
}
export class PostfixExpression extends Expression{
    //call_target:函数重载决策结果——check 在 ArgumentsPostfix 命中重载组时写入实际函数名(f2/f3),
    //desugar 据此把调用标识符改写为该名,指向具体重载槽
    public call_target:string=null
    constructor(public expr:Expression,public postfix:Postfix[],public types:Type[]=[]) {
        super()
    }
}
export class Prefix{}
export class IncrementPrefix extends Prefix{}
export class DecrementPrefix extends Prefix{}
export class NotPrefix extends Prefix{}
export class BitNotPrefix extends Prefix{}
export class MinusPrefix extends Prefix{}
export class ReferencePrefix extends Prefix{}
export class AddressPrefix extends Prefix{}
export class NewPrefix extends Prefix{}
export class TypePrefix extends Prefix{
    constructor(public type:Type) {
        super()
    }
}
export class PrefixExpression extends Expression{
    constructor(public expr:Expression,public prefix:Prefix[]) {
        super()
    }
}
export class BinaryExpression extends Expression{
    //oper:运算符重载决策结果——check 阶段命中 operation 时写入符号('+'/'[]'等),
    //desugar 据此把二元运算脱糖成容器静态函数调用(无重载时保持 null 走原生语义)
    constructor(public left:Expression,public right:Expression,public oper:string=null) {
        super()
    }
}
export class AdditiveExpression extends BinaryExpression{}
export class SubtractiveExpression extends BinaryExpression{}
export class MultiplicativeExpression extends BinaryExpression{}
export class ModExpression extends BinaryExpression{}
export class DivisionExpression extends BinaryExpression{}
export class ShiftLeftExpression extends BinaryExpression{}
export class ShiftRightExpression extends BinaryExpression{}
export class GreaterExpression extends BinaryExpression{}
export class LessExpression extends BinaryExpression{}
export class GreaterEqualExpression extends BinaryExpression{}
export class LessEqualExpression extends BinaryExpression{}
export class EqualityExpression extends BinaryExpression{}
export class InequalityExpression extends BinaryExpression{}
export class BitwiseAndExpression extends BinaryExpression{}
export class BitwiseXorExpression extends BinaryExpression{}
export class BitwiseOrExpression extends BinaryExpression{}
export class LogicalAndExpression extends BinaryExpression{}
export class LogicalOrExpression extends BinaryExpression{}
export class TernaryExpression extends Expression{
    constructor(public condition:Expression,public trueExpr:Expression,public falseExpr:Expression) {
        super()
    }
}