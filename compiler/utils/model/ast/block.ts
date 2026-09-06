import {ASTTree} from '../../data'
import {Expression, LambdaExpression} from './expr'
import {Type} from './identifier'
import {Command} from './command'
export class Link extends ASTTree{
    constructor(public module:string[],public as:string) {
        super()
    }
}
export class Modifier extends ASTTree{
    constructor(public unstatic:boolean,public _async:boolean,public _private:boolean) {
        super()
    }
}
export class Block extends ASTTree{
    constructor(public modifiers:Modifier,public name:string) {
        super()
    }
}
export class Module extends Block{
    constructor(modifiers:Modifier,name:string,public children:Block[]) {
        super(modifiers,name)
    }
}
export class Class extends Block{
    constructor(modifiers:Modifier,name:string,public generic:Map<string,Type>,public implement:Type,public children:Block[]) {
        super(modifiers,name)
    }
}
export class Interface extends Block{
    constructor(modifiers:Modifier,name:string,public generic:Map<string,Type>,public implement:Type,public children:Block[]) {
        super(modifiers,name)
    }
}
export class Enum extends Block{
    constructor(modifiers:Modifier,name:string,public children:string[]) {
        super(modifiers,name)
    }
}
export class Function extends Block{
    //重载序号:同名函数第几个(0=首个)。desugar 改名 f/f2/f3 区分槽位;调用点按决策指向具体序号
    public index:number=0
    constructor(modifiers:Modifier,name:string,public generic:Map<string,Type>,public params:Map<string,Type>,public return_type:Type,public commands:Command) {
        super(modifiers,name)
    }
}
export class Variable extends Block{
    constructor(modifiers:Modifier,name:string,public t:Type,public value:Expression) {
        super(modifiers,name)
    }
}
export class File extends ASTTree{
    constructor(public links:Link[],public children:Block[]) {
        super()
    }
}
export class Operation extends Block{
    constructor(public oper:string,public command:LambdaExpression) {
        super(null,null)
    }
}
export class Cast extends Block{
    constructor(public t:Type,public command:LambdaExpression) {
        super(null,null)
    }
}
export class Value extends Block{
    constructor(public value:Type,public children:Block[]) {
        super(null,null)
    }
}