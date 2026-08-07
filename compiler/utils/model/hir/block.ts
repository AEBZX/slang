import {HIRTree} from '../../data'
import {HExpr} from './expr'
export class HBlock extends HIRTree{}
export class HModule extends HBlock{
    constructor(public name:number,public children:HBlock[]) {
        super()
    }
}
export class HClass extends HBlock{
    constructor(public name:number,public children:HBlock[],public constructor_id:number=-1,public this_id:number=-1) {
        super()
    }
}
export class HVariable extends HBlock{
    constructor(public name:number,public value:HExpr,public unstatic:boolean=true) {
        super()
    }
}