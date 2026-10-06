export type peephole_type='lexer'|'parser'|'check'|'desugar'|'hir'|'ir'|'optimize'|'generate'
export default class PeepholeTool{
    constructor(public name:peephole_type) {
    }
    run(param:any):any{
    }
    use(data:any):PeepholeTool{
        return null
    }
}
export class PeepholeScope{
    constructor(public parent:PeepholeScope,public global:PeepholeScope){
    }
    enter():PeepholeScope{
        return new PeepholeScope(this,this.global)
    }
    leave():PeepholeScope{
        return this.parent
    }
}
export type init_peephole=(param:any)=>PeepholeScope
export type process=(param:any,scope:PeepholeScope)=>PeepholeTree
export class PeepholeTree{}