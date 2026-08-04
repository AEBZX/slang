import {ASTTree} from '../data'
import {Expression} from './expr'
import {Type} from './identifier'
export class Command extends ASTTree{}
export class BasicCommand extends Command{}
export class Assign extends BasicCommand{
    constructor(public data:Expression,public value:Expression) {
        super()
    }
}
export class AAssign extends Assign{}
export class AddAssign extends Assign{}
export class SubAssign extends Assign{}
export class MulAssign extends Assign{}
export class DivAssign extends Assign{}
export class ModAssign extends Assign{}
export class BitAndAssign extends Assign{}
export class BitOrAssign extends Assign{}
export class BitXorAssign extends Assign{}
export class BitShlAssign extends Assign{}
export class BitShrAssign extends Assign{}
export class VarDeclaration extends BasicCommand{
    constructor(public name:string,public t:Type,public value:Expression) {
        super()
    }
}
export class Call extends BasicCommand{
    constructor(public data:Expression,public await_:boolean) {
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
    constructor(public data:string) {
        super()
    }
}
export class Increment extends BasicCommand{
    constructor(public data:Expression) {
        super()
    }
}
export class Decrement extends BasicCommand{
    constructor(public data:Expression) {
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
    constructor(public init:VarDeclaration[],public condition:Expression,public step:BasicCommand[],public commands:Command) {
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