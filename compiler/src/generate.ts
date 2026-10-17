import {
    BINARY,
    BIT_NOT,
    CALL,
    CMP, ControlStream, ControlStreamCond,
    CZ, DELETE, GC, IN, IRArgs,
    IRTree,
    JMP,
    JZ,
    LOAD,
    MOV,
    NOT, OFFSET_ADDR, OFFSET_GET,
    OFFSET_SET, OFFSET_STR_ADDR, OFFSET_STR_GET, OFFSET_STR_SET, OUT, PARAM_LOAD, PARAM_SET,
    POP,
    PUSH,
    RET,
    THREAD,
    TZ
} from './utils'
import Generate from './utils/lib/generate'
import {OPTTool} from './optimize/tool'
//指令4字节,3参数12字节,共16字节
export type slang_generate_visitor=(data:IRTree)=>Buffer
//实际为command r/v r/v r/v形式所以一个占8位偏移
const CommandOffset=new Map<any,number>([
    [LOAD,0],
    [MOV,1],
    //binary有更多类型,add,sub,mul,div,mod,shl,shr,and,or,xor,共10个
    [BINARY,2],
    [CMP,12],
    [NOT,13],
    [BIT_NOT,14],
    [JMP,15],
    [CALL,16],
    [THREAD,17],
    [JZ,18],
    [CZ,19],
    [TZ,20],
    [RET,21],
    [PUSH,22],
    [POP,23],
    [OFFSET_SET,24],
    [OFFSET_GET,25],
    [OFFSET_ADDR,26],
    [OFFSET_STR_SET,27],
    [OFFSET_STR_GET,28],
    [OFFSET_STR_ADDR,29],
    [IN,30],
    [OUT,31],
    [GC,32],
    [DELETE,33],
    [PARAM_SET,34],
    [PARAM_LOAD,35]
])
const BinaryOffset=new Map<string,number>([
    ['add',0],
    ['sub',1],
    ['mul',2],
    ['div',3],
    ['mod',4],
    ['shl',5],
    ['shr',6],
    ['and',7],
    ['or',8],
    ['xor',9]
])
//操作数形式偏移:三个操作数的 reg/value 就是三位,reg=0、value=1
function offest(v1:IRArgs,v2:IRArgs,v3:IRArgs){
    return (v1.type=='value'?4:0)+(v2.type=='value'?2:0)+(v3.type=='value'?1:0)
}
function ins_id(data:IRTree,v1:IRArgs,v2:IRArgs,v3:IRArgs){
    //先按具体类精确匹配:OFFSET_ADDR 继承 OFFSET_GET、OFFSET_STR_* 继承 OFFSET_*,
    //照 instanceof 的顺序扫会被认成父类的操作码
    let ins_offset:number=null
    for(const [key,value] of CommandOffset)
        if(data.constructor===key)ins_offset=value
    if(ins_offset==null)
        for(const [key,value] of CommandOffset)
            if(data instanceof key)ins_offset=value
    const type_offset=data instanceof BINARY?BinaryOffset.get(data.id):0
    const v_offset=offest(v1,v2,v3)
    return (ins_offset+type_offset)*8+v_offset
}
function fill(data:IRTree,v1:IRArgs=null,v2:IRArgs=null,v3:IRArgs=null){
    //只有一两个操作数的指令(load/ret/push/pop/gc…)缺的按 reg 0 补,类型也要参与操作码计算
    v1=v1??IRArgs.reg(0)
    v2=v2??IRArgs.reg(0)
    v3=v3??IRArgs.reg(0)
    let buffer=Buffer.alloc(16)
    buffer.writeUint32BE(ins_id(data,v1,v2,v3),0)
    buffer.writeUint32BE(v1.data,4)
    buffer.writeUint32BE(v2.data,8)
    buffer.writeUint32BE(v3.data,12)
    return buffer
}
const G_LOAD:slang_generate_visitor=(data:LOAD)=>fill(data,data.reg,data.data)
const G_MOV:slang_generate_visitor=(data:MOV)=>fill(data,data.left,data.right)
const G_BINARY:slang_generate_visitor=(data:BINARY)=>fill(data,data.result,data.left,data.right)
const G_NOT_BIT_NOT:slang_generate_visitor=(data:NOT|BIT_NOT)=>fill(data,data.left,data.right)
const G_CMP:slang_generate_visitor=(data:CMP)=>fill(data,data.left,data.right,data.oper)
const G_ControlStream:slang_generate_visitor=(data:ControlStream)=>{
    if(data instanceof ControlStreamCond)return fill(data,data.target,data.frame,data.cond)
    return fill(data,data.target,data.frame)
}
const G_RET:slang_generate_visitor=(data:RET)=>fill(data,data.frame)
const G_PUSH:slang_generate_visitor=(data:PUSH)=>fill(data,data.target)
const G_POP:slang_generate_visitor=(data:POP)=>fill(data)
const G_OFFSET_SET:slang_generate_visitor=(data:OFFSET_SET)=>fill(data,data.target,data.offset,data.value)
const G_OFFSET_GET:slang_generate_visitor=(data:OFFSET_GET)=>fill(data,data.target,data.data,data.offset)
const G_IN_OUT:slang_generate_visitor=(data:IN|OUT)=>fill(data,data.oper,data.target)
const G_GC:slang_generate_visitor=(data:GC)=>fill(data)
const G_DELETE:slang_generate_visitor=(data:DELETE)=>fill(data,data.data)
const G_PARAM_SET:slang_generate_visitor=(data:PARAM_SET)=>fill(data,data.param,data.value)
const G_PARAM_LOAD:slang_generate_visitor=(data:PARAM_LOAD)=>fill(data,data.data,data.param)
export default new Generate().use(new Map<any,slang_generate_visitor>([
    [LOAD,G_LOAD],
    [MOV,G_MOV],
    [BINARY,G_BINARY],
    [NOT,G_NOT_BIT_NOT],
    [BIT_NOT,G_NOT_BIT_NOT],
    [CMP,G_CMP],
    [JMP,G_ControlStream],
    [CALL,G_ControlStream],
    [THREAD,G_ControlStream],
    [JZ,G_ControlStream],
    [CZ,G_ControlStream],
    [TZ,G_ControlStream],
    [RET,G_RET],
    [PUSH,G_PUSH],
    [POP,G_POP],
    [OFFSET_SET,G_OFFSET_SET],
    [OFFSET_GET,G_OFFSET_GET],
    //OFFSET_ADDR 与 OFFSET_STR_* 的操作数形状与父类一致,复用同一套
    [OFFSET_ADDR,G_OFFSET_GET],
    [OFFSET_STR_SET,G_OFFSET_SET],
    [OFFSET_STR_GET,G_OFFSET_GET],
    [OFFSET_STR_ADDR,G_OFFSET_GET],
    [IN,G_IN_OUT],
    [OUT,G_IN_OUT],
    [GC,G_GC],
    [DELETE,G_DELETE],
    [PARAM_SET,G_PARAM_SET],
    [PARAM_LOAD,G_PARAM_LOAD]
])).use((tool:OPTTool,call)=>{
    let head:Buffer[]=[]
    head.push(Buffer.from('SLANG','utf-8'),Buffer.from('1.0.0','utf-8'))
    let pool:Buffer[]=[]
    pool.push(Buffer.from('POOL_START','utf-8'))
    for(const [k,v] of tool.pool){
        const type:number=typeof v=='number'?1:0
        let head=Buffer.alloc(9)
        const data=type==1?(()=>{
            let ls=Buffer.alloc(8)
            ls.writeDoubleBE(v as number,0)
            return ls
        })():Buffer.from(v as string,'utf-8')
        head.writeUint32BE(k,0)
        head.writeUint8(type,4)
        head.writeUint32BE(data.length,5)
        pool.push(head,data)
    }
    pool.push(Buffer.from('POOL_END','utf-8'))
    let code:Buffer[]=[]
    code.push(Buffer.from('CODE_START','utf-8'))
    for(const [id,ir] of tool.command){
        let block=Buffer.alloc(16)
        block.writeUint32BE(0xFFFFFFFF,0)
        block.writeUint32BE(id,4)
        block.writeUint32BE(0,8)
        block.writeUint32BE(0,12)
        let commands:Buffer[]=[]
        for(const command of ir)
            commands.push(call(command))
        code.push(block,Buffer.concat(commands))
        let end=Buffer.alloc(16)
        end.writeUint32BE(0xFFFFFFFF-1,0)
        end.writeUint32BE(0,4)
        end.writeUint32BE(0,8)
        end.writeUint32BE(0,12)
        code.push(end)
    }
    return Buffer.concat([...head,...pool,...code])
})