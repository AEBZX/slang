import expr from './expr'
import block from './block'
import command from './command'
import {HScope} from './tool'
import {HIR, HModule, HVariable} from '../utils'
export default new HIR().use(expr).use(block).use(command).use((param:File[])=>{
    return new HScope(null,new HScope(null,null))
}).use((param:HModule[],scope:HScope)=>{
    //扁平化
    let ret:(HModule|HVariable)[]=[]
    const add=(data:HModule|HVariable)=>{
        ret.push(data)
        if(data instanceof HModule)
            data.children.forEach(add)
    }
    param.forEach(add)
    return ret.filter(i=>i.name!=null)
})