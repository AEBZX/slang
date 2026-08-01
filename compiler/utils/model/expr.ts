import {ASTTree} from '../data'
import {Type} from './identifier'
import {Command} from './command.js'
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
    constructor(public params:Map<string,Type>,public ret:Type,public body:Command) {
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
    constructor(public args:Expression[]) {
        super()
    }
}
export class PostfixExpression extends Expression{
    constructor(public expr:PrimaryExpression,public postfix:Postfix[]) {
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
export class PrefixExpression extends Expression{
    constructor(public expr:PrimaryExpression,public prefix:Prefix[]) {
        super()
    }
}
export class BinaryExpression extends Expression{
    constructor(public left:Expression,public right:Expression) {
        super()
    }
}
export class AdditiveExpression extends BinaryExpression{}
export class MultiplicativeExpression extends BinaryExpression{}
export class ShiftExpression extends BinaryExpression{}
export class RelationalExpression extends BinaryExpression{}
export class EqualityExpression extends BinaryExpression{}
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