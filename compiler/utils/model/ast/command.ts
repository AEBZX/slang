import {ASTTree} from '../../data'
import {Expression} from './expr'
import {Type} from './identifier'
export class Command extends ASTTree{}
export class BasicCommand extends Command{}
export class Assign extends BasicCommand{
    public oper:string=null
    public cast:string=null
    constructor(public data:Expression,public value:Expression,public op:string) {
        super()
    }
}
export class AAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'=')
    }
}
export class AddAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'+=')
    }
}
export class SubAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'-=')
    }
}
export class MulAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'*=')
    }
}
export class DivAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'/=')
    }
}
export class ModAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'%=')
    }
}
export class AndAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'&=')
    }
}
export class OrAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'|=')
    }
}
export class XorAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'^=')
    }
}
export class ShlAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'<<=')
    }
}
export class ShrAssign extends Assign{
    constructor(data:Expression,value:Expression) {
        super(data,value,'>>=')
    }
}
export class VarDecl extends BasicCommand{
    public oper:string=null
    public cast:string=null
    constructor(public name:string,public t:Type,public value:Expression) {
        super()
    }
}
export class Await extends BasicCommand{
    constructor(public command:Command) {
        super()
    }
}
export class ExprCommand extends BasicCommand{
    constructor(public data:Expression) {
        super()
    }
}
export class Return extends BasicCommand{
    constructor(public data:Expression) {
        super()
    }
}
export class Break extends BasicCommand{}
export class Continue extends BasicCommand{}
export class Throw extends BasicCommand{
    constructor(public data:Expression) {
        super()
    }
}
export class VM extends BasicCommand{
    constructor(public data:string,public param:Expression[]) {
        super()
    }
}
export class BlockCommand extends Command{}
export class IfStatement extends BlockCommand{
    constructor(public condition:Expression,public commands:Command,public else_:Command) {
        super()
    }
}
export class WhileStatement extends BlockCommand{
    constructor(public condition:Expression,public commands:Command) {
        super()
    }
}
export class DoWhileStatement extends BlockCommand{
    constructor(public commands:Command,public condition:Expression) {
        super()
    }
}
export class ForStatement extends BlockCommand{
    constructor(public init:VarDecl[],public condition:Expression,public step:BasicCommand[],public commands:Command) {
        super()
    }
}
export class ForeachStatement extends BlockCommand{
    constructor(public iden:string,public data:Expression,public commands:Command) {
        super()
    }
}
export class Case{
    constructor(public condition:Expression,public commands:Command) {
    }
}
export class SwitchStatement extends BlockCommand{
    constructor(public condition:Expression,public case_list:Case[],public default_:Command) {
        super()
    }
}
export class TryStatement extends BlockCommand{
    constructor(public commands:Command,public catch_:{iden:string,type:Type,command:Command},public finally_:Command) {
        super()
    }
}
export class ListCommand extends BlockCommand{
    constructor(public commands:Command[]) {
        super()
    }
}