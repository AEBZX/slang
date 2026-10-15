import IR from '../utils/lib/ir'
import expr from './expr'
import command from './command'
import block from './block'
import {HScope} from '../hir/tool'
import {HModule, IRTree} from '../utils'
import {IRTool} from './tool'
export default new IR().use(expr).use(command).use(block).use((param:[HScope,HModule[]])=>{
    return new IRTool(param[0].id())
})