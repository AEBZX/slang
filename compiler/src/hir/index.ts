import expr from './expr'
import block from './block'
import command from './command'
import {HScope} from './tool'
import {HIR, HModule, HVariable, HVM, Variable} from '../utils'
export default new HIR().use(expr).use(block).use(command).use((param:File[])=>{
    return new HScope(null,new HScope(null,null))
})