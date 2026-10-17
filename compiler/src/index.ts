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
        //插件换的是工具链,不能覆盖流水线数据
        for(const i of this.plu) this.tool=i(this.tool)
        ;(this.tool[toolToRound.get('generate')] as Generate).local=local
        for(const t of this.tool){
            const out=t.run(ret)
            //check 产出的是符号表与诊断,流水线数据仍然是 files,不能往后传
            if(t.name!='check'){
                ret=out
                continue
            }
            //诊断不能静默丢掉:有错就停在这里,把整批消息带出去
            const scope:any=out
            const errs:string[]=Array.isArray(scope?.error)?scope.error:((scope?.global?.error)??[])
            if(errs.length>0)
                throw new Error(`check 报错:\n${errs.join('\n')}`)
        }
        //最后一级(generate)的产物:字节码
        return ret
    }
}
export default function(code:string[],local:string,plugin:plugin[]=[]){
    return new Runner().register(lexer).register(parser).register(check).register(desugar).register(hir).register(ir)
        .register(optimize).register(generate).plugin(...plugin).run(code,local)
}