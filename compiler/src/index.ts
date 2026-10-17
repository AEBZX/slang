//内置
import generate from './generate'
import lexer from './lexer'
import parser from './parser'
import check from './check'
import desugar from './desugar'
import hir from './hir'
import ir from './ir'
import optimize from './optimize'
import PeepholeTool from './utils/lib/tool'
import Generate from './utils/lib/generate'
const toolToRound=new Map<string,number>([
    ['lexer',0],
    ['parser',1],
    ['check',2],
    ['desugar',3],
    ['hir',4],
    ['ir',5],
    ['optimize',6],
    ['generate',7]
])
type plugin=(tool:PeepholeTool[])=>PeepholeTool[]
class Runner{
    tool:PeepholeTool[]=[]
    plu:plugin[]=[]
    register(tool:PeepholeTool){
        this.tool[toolToRound.get(tool.name)]=tool
        return this
    }
    plugin(...pl:plugin[]){
        this.plu.push(...pl)
        return this
    }
    run(code:string[],local:string){
        let ret:any=code
        for(const i of this.plu) ret=i(this.tool);
        (this.tool[toolToRound.get('generate')] as Generate).local=local
        for(const t of this.tool)
            ret=t.run(ret)
    }
}
export default function(code:string[],local:string,plugin:plugin[]){
    new Runner().register(lexer).register(parser).register(check).register(desugar).register(hir).register(ir)
        .register(optimize).register(generate).plugin(...plugin).run(code,local)
}