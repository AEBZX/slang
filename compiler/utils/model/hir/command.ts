import {HIRTree} from '../../data'
import {HExpr} from './expr'
export class HCommand extends HIRTree{}
export class HAssign extends HCommand{
    constructor(public data:HExpr,public value:HExpr) {
        super()
    }
}
export class HCall extends HCommand{
    constructor(public data:HExpr,public args:HExpr[]) {
        super()
    }
}
export class HThread extends HCommand{
    constructor(public data:HExpr,public args:HExpr[]) {
        super()
    }
}
export class HBreak extends HCommand{}
export class HContinue extends HCommand{}
export class HVM extends HCommand{
    constructor(public data:string) {
        super()
    }
}
export class HReturn extends HCommand{
    constructor(public data:HExpr) {
        super()
    }
}
export class HIfStatement extends HCommand{
    constructor(public condition:HExpr,public commands:HCommand,public else_:HCommand) {
        super()
    }
}
export class HWhileStatement extends HCommand{
    constructor(public condition:HExpr,public commands:HCommand) {
        super()
    }
}
export class HListCommand extends HCommand{
    constructor(public commands:HCommand[]) {
        super()
    }
}