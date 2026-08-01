import {ASTTree} from '../data'
import {Expression} from './expr'
import {Type} from './identifier'
import {Command} from './command'
export class Link extends ASTTree{
    constructor(public module:string[],public as:string) {
        super()
    }
}
export class Modifier extends ASTTree{
    constructor(public unstatic:boolean,public sync:boolean,_private:boolean) {
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
    constructor(modifiers:Modifier,name:string,public implement:string[],public children:Block[]) {
        super(modifiers,name)
    }
}
export class Interface extends Block{
    constructor(modifiers:Modifier,name:string,public implement:string[],public children:Block[]) {
        super(modifiers,name)
    }
}
export class Enum extends Block{
    constructor(modifiers:Modifier,name:string,public children:string[]) {
        super(modifiers,name)
    }
}
export class Function extends Block{
    constructor(modifiers:Modifier,name:string,public params:Map<string,Type>,public return_type:Type,public commands:Command) {
        super(modifiers,name)
    }
}
export class Variable extends Block{
    constructor(modifiers:Modifier,name:string,public t:Type,public value:Expression) {
        super(modifiers,name)
    }
}
export class File extends ASTTree{
    constructor(public links:Link[],public children:Block) {
        super()
    }
}