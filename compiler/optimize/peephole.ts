import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP,
    CZ,
    IR,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT,
    number_radix, OFFSET_ADDR, OFFSET_GET, OFFSET_SET,
    opt_visitor,
    THREAD,
    TZ
} from '../utils'
const P_MOV:opt_visitor=(data:MOV, tool, bid, index)=>{
    const $=tool.$
    if(data.left==data.right)tool._mark(bid,index)
    if($.rvalue(data.left)==$.value(data.right)&&$.value(data.right)!=null)tool._mark(bid,index)
    if(!tool.dead(bid,index)){
        $.tset(data.left,bid,index,true,data)
        $.tset(data.right,bid,index,false,data)
    }
}
const P_LOAD:opt_visitor=(data:LOAD, tool, bid, index)=>{
    const $=tool.$
    if($.rvalue(data.reg)==$.pvalue(data.data))tool._mark(bid,index)
    if(!tool.dead(bid,index)){
        $.tset(data.reg,bid,index,true,data)
        $.tset(data.data,bid,index,false,data)
    }
}
const P_OFFSET_SET:opt_visitor=(data:OFFSET_SET, tool, bid, index)=>{
    const $=tool.$
    $.tset(data.target,bid,index,true,data)
    $.tset(data.offset,bid,index,false,data)
    $.tset(data.value,bid,index,false,data)
}
//a+0,a-0,a*1,a/1,a mod 1
const P_BINARY:opt_visitor=(data:BINARY, tool, bid, index) => {
    const $=tool.$
    let _data:IR=data
    let r=$.value(data.right)
    let l=$.value(data.left)
    if(data.id=='add'&&l==0||r==0)_data=new MOV(data.result,l==0?data.right:data.left)
    if(data.id=='sub') {
        if(r==0)_data=new MOV(data.result, data.left)
        if(l==r&&l!=null)_data=new MOV(data.result,['reg',0])
    }
    if(data.id=='mul'){
        if(r==0||l==0)_data=new MOV(data.result,['reg',0])
        if(r==1||l==1)_data=new MOV(data.result,r==1?data.left:data.right)
    }
    if(data.id=='div'){
        if(r==1)_data=new MOV(data.result,data.left)
        if(l==0)_data=new MOV(data.result,['reg',0])
        if(r==l&&r!=null)_data=new MOV(data.result,['reg',1])
    }
    if(data.id=='mod'&&l==r&&l!=null)_data=new MOV(data.result,['reg',1])
    if(data.id=='shl'||data.id=='shr'&&r==0)_data=new MOV(data.result,data.left)
    if(data.id=='and') {
        if (l == r && l != null)_data= new MOV(data.result, data.left)
        if (r == 0) _data = new MOV(data.result,['reg',0])
    }
    if(data.id=='or'&&(l==r&&l!=null)||r==0)_data=new MOV(data.result,data.left)
    if(data.id=='xor'){
        if(l==r&&l!=null)_data=new MOV(data.result,['reg',0])
        if(r==0)_data=new MOV(data.result,data.left)
        //a^1^1=a
        if(r==1){
            let last=$.t(data.left)
            if(last!=null&&last[3] instanceof BINARY&&last[3].id=='xor'){
                let r=$.rvalue(last[3].result),_r=$.value(last[3].right),_l=$.value(last[3].left)
                if(r==_r&&r!=null&&_l==1){
                    tool._mark(last[0],last[1])
                    _data=new MOV(data.result,data.left)
                }
            }
        }
    }
    if(_data!=data)tool.replace(bid,index,_data)
    $.tset(data.result,bid,index,true,_data)
    $.tset(data.left,bid,index,false,_data)
    $.tset(data.result,bid,index,false,_data)
}
const P_NOT:opt_visitor=(data:NOT, tool, bid, index)=>{
    const $=tool.$
    let last=$.t(data.data)
    if(last!=null&&last[3] instanceof NOT){
        tool._mark(bid,index)
        tool._mark(last[0],last[1])
    }else $.tset(data.data,bid,index,true,data)
}
const P_BIT_NOT:opt_visitor=(data:BIT_NOT, tool, bid, index)=>{
    const $=tool.$
    let last=$.t(data.data)
    if(last!=null&&last[3] instanceof BIT_NOT){
        tool._mark(bid,index)
        tool._mark(last[0],last[1])
    }else $.tset(data.data,bid,index,true,data)
}
const P_CMP:opt_visitor=(data:CMP, tool, bid, index)=>{
    const $=tool.$
    let _data:IR=data
    let r=$.value(data.right),l=$.rvalue(data.left),o=$.value(data.oper)
    if(o==null)return
    if(r==l&&r!=null){
        if([0,4,5].includes(o as number))_data=new MOV(data.right,['reg',1])
        if([1,2,3].includes(o as number))_data=new MOV(data.right,['reg',0])
        if(data!=_data)tool.replace(bid,index,_data)
        $.tset(data.left,bid,index,true,_data)
        $.tset(data.right,bid,index,false,_data)
        $.tset(data.oper,bid,index,false,_data)
    }
    let last=$.t(data.left)
    if(last!=null&&last[3] instanceof CMP&&[1,0].includes(r as number)&&[0,1].includes(o as number)){
        let a=$.value(data.left)
        let b=$.value(last[3].left)
        if(a==b&&a!=null){
            if((o==0&&r==0)||(o==1&&r==1)){
                tool._mark(bid,index)
                return
            }
            if((o==1&&r==0)||(o==0&&r==1)){
                _data=new NOT(data.left)
                tool.replace(bid,index,_data)
                $.tset(data.left,bid,index,true,_data)
            }
        }
    }
}
const P_JZ:opt_visitor=(data:JZ, tool, bid, index)=>{
    const $=tool.$
    let c=$.value(data.cond)
    if(c==1){
        let _data=new JMP(data.target)
        tool.replace(bid,index,_data)
        $.tset(data.target,bid,index,true,_data)
    }
    if(c==0)tool._mark(bid,index)
}
const P_CZ:opt_visitor=(data:CZ, tool, bid, index)=>{
    const $=tool.$
    let c=$.value(data.cond)
    if(c==1){
        let _data=new CALL(data.target)
        tool.replace(bid,index,_data)
        $.tset(data.target,bid,index,true,_data)
    }
    if(c==0)tool._mark(bid,index)
}
const P_TZ:opt_visitor=(data:TZ, tool, bid, index)=>{
    const $=tool.$
    let c=$.value(data.cond)
    if(c==1){
        let _data=new THREAD(data.target)
        tool.replace(bid,index,_data)
        $.tset(data.target,bid,index,true,_data)
    }
    if(c==0)tool._mark(bid,index)
}
const P_OFFSET_GET:opt_visitor=(data:OFFSET_GET, tool, bid, index)=>{
    const $=tool.$
    let _data:IR=data
    let t=$.value(data.data),o=$.value(data.offset)
    let _t=$.t(data.data),_o=$.t(data.data)
    let __data=_t[3]
    if(_t==_o&&__data instanceof OFFSET_SET&&$.value(__data.target)==t&&$.value(__data.offset)==o)
        _data=new MOV(data.target,__data.value)
    if(data!=_data){
        tool.replace(bid,index,_data)
        $.tset(data.target,bid,index,true,_data)
        $.tset((__data as OFFSET_SET).value,bid,index,false,_data)
        return
    }
    $.tset(data.target,bid,index,true,_data)
    $.tset(data.data,bid,index,false,_data)
    $.tset(data.offset,bid,index,false,_data)
}
//取地址不是值,不参与折叠,只记录依赖
const P_OFFSET_ADDR:opt_visitor=(data:OFFSET_ADDR, tool, bid, index)=>{
    const $=tool.$
    $.tset(data.target,bid,index,true,data)
    $.tset(data.data,bid,index,false,data)
    $.tset(data.offset,bid,index,false,data)
}
export default new Map<any,opt_visitor>([
    [MOV,P_MOV],
    [LOAD,P_LOAD],
    [OFFSET_SET,P_OFFSET_SET],
    [BINARY,P_BINARY],
    [NOT,P_NOT],
    [BIT_NOT,P_BIT_NOT],
    [CMP,P_CMP],
    [JZ,P_JZ],
    [CZ,P_CZ],
    [TZ,P_TZ],
    [OFFSET_GET,P_OFFSET_GET],
    [OFFSET_ADDR,P_OFFSET_ADDR],
])