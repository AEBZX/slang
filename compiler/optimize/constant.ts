import {
    BINARY,
    CALL,
    CMP,
    ControlStream,
    ControlStreamCond,
    CZ, DELETE, IN,
    IRArgs,
    IRTree,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET, OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET, POP, PUSH, RET, THREAD, TZ
} from '../utils'
import {is_reg, value, slang_opt_visitor, rep, BINARYMap, CMPMap} from './tool'
//常量折叠和传播
/*
 * 取value可以出现null,null
 * 但实际上这种情况相当于啥事没有
 * 设置了个寂寞
 */
const C_LOAD:slang_opt_visitor=(data:LOAD,tool,bid,index)=>{
    const left=value(data.reg,tool)
    const right=value(data.data,tool)
    tool.pool_set(left as number,tool.pool.get(right as number))
    data.reg=rep(data.reg,tool)
    data.data=rep(data.data,tool)
    tool.sweep(bid,index,data)
}
const C_MOV:slang_opt_visitor=(data:MOV,tool,bid,index)=>{
    //如果right是常量直接load
    const right=tool.pool_get(value(data.right,tool) as number)
    if(right!=null)
        tool.sweep(bid,index,new LOAD(rep(data.left,tool),IRArgs.reg(tool.getForValue(right))))
    //如果上面优化掉这里会无视,无副作用
    data.left=rep(data.left,tool)
    data.right=rep(data.right,tool)
    tool.sweep(bid,index,data)
}
const C_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=>{
    //left和right都是number,可以优化为MOV
    const left=value(data.left,tool)
    const right=value(data.right,tool)
    if(left!=null&&right!=null&&typeof left=='number'&&typeof right=='number')
        tool.sweep(bid,index,new LOAD(rep(data.result,tool),IRArgs.reg(tool.getForValue(BINARYMap.get(data.id)(left,right)))))
    data.result=rep(data.result,tool)
    data.left=rep(data.left,tool)
    data.right=rep(data.right,tool)
    tool.sweep(bid,index,data)
}
const C_NOT:slang_opt_visitor=(data:NOT,tool,bid,index)=>{
    const v=value(data.data,tool)
    if(v!=null&&typeof v=='number')
        tool.sweep(bid,index,new LOAD(rep(data.data,tool),IRArgs.reg(tool.getForValue(~v))))
    data.data=rep(data.data,tool)
    tool.sweep(bid,index,data)
}
const C_CMP:slang_opt_visitor=(data:CMP,tool,bid,index)=>{
    const left=value(data.left,tool)
    const right=value(data.right,tool)
    const oper=value(data.oper,tool)
    if(left!=null&&right!=null&&oper!=null&&typeof oper=='number')
        tool.sweep(bid,index,new LOAD(rep(data.left,tool),IRArgs.reg(tool.getForValue(CMPMap.get(oper)(left,right)))))
    data.left=rep(data.left,tool)
    data.right=rep(data.right,tool)
    data.oper=rep(data.oper,tool)
    tool.sweep(bid,index,data)
}
const C_ControlStream:slang_opt_visitor=(data:ControlStream,tool,bid,index)=>{
    if(data instanceof ControlStreamCond){
        const cond=value(data.cond,tool)
        if(cond!=null&&typeof cond=='number'){
            //不可到达
            if(cond==0)tool.sweep(bid,index,)
            if(cond==1){
                let sweep:ControlStream=null
                if(data instanceof JZ)sweep=new JMP(rep(data.target,tool),rep(data.frame,tool))
                if(data instanceof CZ)sweep=new CALL(rep(data.target,tool),rep(data.frame,tool))
                if(data instanceof TZ)sweep=new THREAD(rep(data.target,tool),rep(data.frame,tool))
                tool.sweep(bid,index,sweep)
            }
        }
        data.frame=rep(data.frame,tool)
        data.cond=rep(data.cond,tool)
        data.target=rep(data.target,tool)
        tool.sweep(bid,index,data)
        return
    }
    data.frame=rep(data.frame,tool)
    data.target=rep(data.target,tool)
    tool.sweep(bid,index,data)
}
const C_RET:slang_opt_visitor=(data:RET,tool,bid,index)=>{
    tool.sweep(bid,index,new RET(rep(data.frame,tool)))
}
const C_PUSHOrPOP:slang_opt_visitor=(data:PUSH|POP,tool,bid,index)=>{
    data.target=rep(data.target,tool)
    tool.sweep(bid,index,data)
}
const C_OFFSET_SET:slang_opt_visitor=(data:OFFSET_SET,tool,bid,index)=>{
    data.target=rep(data.target,tool)
    data.offset=rep(data.offset,tool)
    data.value=rep(data.value,tool)
    tool.sweep(bid,index,data)
}
const C_OFFSET_GET_ADDR:slang_opt_visitor=(data:OFFSET_GET|OFFSET_ADDR,tool,bid,index)=>{
    data.data=rep(data.data,tool)
    data.target=rep(data.target,tool)
    data.offset=rep(data.offset,tool)
    tool.sweep(bid,index,data)
}
const C_IN_OUT:slang_opt_visitor=(data:IN|OUT,tool,bid,index)=>{
    data.oper=rep(data.oper,tool)
    data.target=rep(data.target,tool)
    tool.sweep(bid,index,data)
}
const C_DELETE:slang_opt_visitor=(data:DELETE,tool,bid,index)=>{
    data.data=rep(data.data,tool)
    tool.sweep(bid,index,data)
}
const C_PARAM_LOAD:slang_opt_visitor=(data:PARAM_LOAD,tool,bid,index)=>{
    data.data=rep(data.data,tool)
    data.param=rep(data.param,tool)
    tool.sweep(bid,index,data)
}
const C_PARAM_SET:slang_opt_visitor=(data:PARAM_SET,tool,bid,index)=>{
    data.value=rep(data.value,tool)
    data.param=rep(data.param,tool)
    tool.sweep(bid,index,data)
}