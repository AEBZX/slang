import {IRTool} from '../ir/tool'
import {OPTTool} from './tool'
import Optimize from '../utils/lib/optimize'
export default new Optimize().use((tool:IRTool,call)=>{
    const opt=new OPTTool(tool.code,tool.const_pool,tool._id)
    return opt
})
