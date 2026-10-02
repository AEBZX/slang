import {ASTTree} from '../../data'
import {Type} from './identifier'
import {Command} from './command'
export class Expression extends ASTTree{
    public oper:string=null
    public cast:string=null
}
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
export class PostfixExpression extends Expression{
    constructor(public expr:Expression) {
        super()
    }
}
export class IncrementPostfix extends PostfixExpression{}
export class DecrementPostfix extends PostfixExpression{}
export class MemberPostfix extends PostfixExpression{
    constructor(expr:Expression,public name:string) {
        super(expr)
    }
}
export class IndexPostfix extends PostfixExpression{
    constructor(expr:Expression,public index:Expression) {
        super(expr)
    }
}
export class ArgumentsPostfix extends PostfixExpression{
    public call_target:string=null
    constructor(expr:Expression,public generic:Type[],public args:Expression[]) {
        super(expr)
    }
}
export class PrefixExpression extends Expression{
    constructor(public expr:Expression) {
        super()
    }
}
export class IncrementPrefix extends PrefixExpression{}
export class DecrementPrefix extends PrefixExpression{}
export class NotPrefix extends PrefixExpression{}
export class BitNotPrefix extends PrefixExpression{}
export class MinusPrefix extends PrefixExpression{}
export class ReferencePrefix extends PrefixExpression{}
export class AddressPrefix extends PrefixExpression{}
export class NewPrefix extends PrefixExpression{}
export class TypePrefix extends PrefixExpression{
    constructor(expr:Expression,public type:Type) {
        super(expr)
    }
}
export class BinaryExpression extends Expression{
    constructor(public left:Expression,public right:Expression,public op:string) {
        super()
    }
}
export class AddExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'+')
    }
}
export class SubExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'-')
    }
}
export class MulExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'*')
    }
}
export class ModExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'%')
    }
}
export class DivExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'/')
    }
}
export class ShlExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'<<')
    }
}
export class ShrExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'>>')
    }
}
export class GreaterExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'>')
    }
}
export class LessExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'<')
    }
}
export class GreaterEqualExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,">=")
    }
}
export class LessEqualExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'<=')
    }
}
export class EqualExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'==')
    }
}
export class InequalExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'!=')
    }
}
export class AndExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'&')
    }
}
export class XorExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'^')
    }
}
export class OrExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'|')
    }
}
export class LogicAndExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'&&')
    }
}
export class LogicOrExpression extends BinaryExpression{
    constructor(left:Expression,right:Expression) {
        super(left,right,'||')
    }
}
export class TernaryExpression extends Expression{
    constructor(public condition:Expression,public trueExpr:Expression,public falseExpr:Expression) {
        super()
    }
}