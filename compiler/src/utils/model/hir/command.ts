import {HIRTree} from '../../data'
import {HExpr} from './expr'
export class HCommand extends HIRTree{}
export class HAssign extends HCommand{
    constructor(public data:HExpr,public value:HExpr) {
        super()
    }
}
export class HLabel extends HCommand{
    constructor(public name:number) {
        super()
    }
}
export class HGoto extends HCommand{
    constructor(public label:number) {
        super()
    }
}
export class HVM extends HCommand{
    constructor(public data:string,public param:HExpr[]) {
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
export class HAwait extends HCommand{
    constructor(public command:HCommand) {
        super()
    }

}
export class HListCommand extends HCommand{
    constructor(public commands:HCommand[]) {
        super()
    }
}
export class HExprCommand extends HCommand{
    constructor(public data:HExpr) {
        super()
    }
}
export class HTryStatement extends HCommand{
    constructor(public try_:HCommand,public catch_:HCommand,public iden:number,public finally_:HCommand) {
        super()
    }
}
export class HThrow extends HCommand{
    constructor(public data:HExpr) {
        super()
    }
}