import {BINARY, CMP, IRArgs, LOAD, MOV, NOT, OFFSET_SET, PARAM_LOAD} from '../utils'
import {slang_opt_visitor, value} from './tool'
//窥孔以及复制传播,局部剔除
const P_LOAD:slang_opt_visitor=(data:LOAD,tool,bid,index)=>{
    if(data.reg.type=='value')
        tool.clear()
    const get=tool.peephole_get(data.reg)
    //写2次前一次无用
    if(get[0])
        tool.sweep(bid,index,get[1],get[2],get[3])
    tool.peephole_set(data.reg,data,bid,index,true)
    tool.peephole_set(data.data,data,bid,index,false)
}
const P_MOV:slang_opt_visitor=(data:MOV, tool, bid, index)=>{
    if(data.left.type=='value')
        tool.clear()
    /*
    mov a,b
    mov c,a
    ->mov c b
     */
    const a_get=tool.peephole_get(data.left)
    if(a_get[0])
        tool.sweep(bid,index,a_get[1],a_get[2],a_get[3])
    //是否mov a a
    if(data.left.data==data.right.data&&data.left.type=='reg'&&data.right.type=='value'){
        tool.sweep(bid,index)
        return
    }
    const b_get=tool.peephole_get(data.right)
    //替换left为a
    if(b_get[0]){
        let ir=b_get[3]
        if(ir instanceof MOV)ir.left=data.left
        if(ir instanceof LOAD)ir.reg=data.left
        if(ir instanceof PARAM_LOAD)ir.data=data.left
        if(ir instanceof OFFSET_SET)ir.target=data.left
        if(ir instanceof NOT)return
        if(ir instanceof BINARY)ir.result=data.left
        if(ir instanceof CMP)return
        tool.sweep(bid,index,ir)
    }
    tool.peephole_set(data.left,data,bid,index,true)
    tool.peephole_set(data.right,data,bid,index,false)
}
const P_BINARY:slang_opt_visitor=(data:BINARY,tool,bid,index)=> {
    if (data.result.type == 'value')
        tool.clear()
    //复制传播
    const a_get = tool.peephole_get(data.left)
    const b_get = tool.peephole_get(data.right)
    const c_get = tool.peephole_get(data.result)
    if (c_get[0])
        tool.sweep(bid, index, c_get[1], c_get[2], c_get[3])
    if (a_get[0] && a_get[3] instanceof MOV) {
        data.left = a_get[3].right
        tool.sweep(bid, index, a_get[1], a_get[2], a_get[3])
    }
    if (b_get[0] && b_get[3] instanceof MOV) {
        data.right = b_get[3].right
        tool.sweep(bid, index, b_get[1], b_get[2], b_get[3])
    }
    //a*0,a-a,0/a,a%a,a%1,a&0,a^a,均为0
    const value_a = value(data.left, tool)
    const value_b = value(data.right, tool)
    const null_a = value_a == null
    const null_b = value_b == null
    const mul_and_0 = value_a == 0 || value_b == 0 && ['mul', 'and'].includes(data.id)
    const div_0 = value_a == 0 && data.id == 'div'
    const mod_1 = value_b == 1 && data.id == 'mod'
    const sub_mod_xor_self = !null_a && !null_b && value_a == value_b &&
        ['sub', 'mod', 'xor'].includes(data.id)
    if (mul_and_0 || div_0 || mod_1 || sub_mod_xor_self)
        tool.sweep(bid, index, new LOAD(data.result, IRArgs.reg(tool.getForValue(0))))
    //a&a,a&-1,a|a,a|0,a^0,>>/<<0,a-0,a+0,a*1,a/1,均为a
    const and_or_self = !null_a && !null_b && value_a == value_a && ['and', 'or'].includes(data.id)
    const and_neg1 = value_a == -1 || value_b == -1 && data.id == 'and'
    const or_xor_shr_shl_0 = value_b == 0 && ['or', 'xor', 'shr', 'shl'].includes(data.id)
    const add_0 = value_a == 0 || value_b == 0 && data.id == 'add'
    const sub_0 = value_b == 0 && data.id == 'sub'
    const mul_1 = value_a == 1 || value_b == 1 && data.id == 'mul'
    const div_1 = value_b == 1 && data.id == 'div'
    if (and_or_self || and_neg1 || or_xor_shr_shl_0 || add_0 || sub_0 || mul_1 || div_1)
        tool.sweep(bid, index, new MOV(data.result, data.left))
}