import {HIRTree} from '../../data'
import {HExpr} from './expr'
export class HBlock extends HIRTree{}
export class HModule extends HBlock{
    constructor(public name:number,public children:HBlock[]) {
        super()
    }
}
export class HClass extends HBlock{
    constructor(public name:number,public children:HBlock[]) {
        super()
    }
}
export class HVariable extends HBlock{
    constructor(public name:number,public value:HExpr) {
        super()
    }
}