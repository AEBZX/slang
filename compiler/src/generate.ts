import {
    BINARY,
    BIT_NOT,
    CALL,
    ControlStream, ControlStreamCond,
    CZ, DELETE, GC, IN, INT, INT_GET, INT_REGISTER, IRArgs,
    IRTree,
    JMP,
    JZ,
    MOV,
    NOT, OFFSET_GET,
    OFFSET_SET, OUT, PARAM_LOAD, PARAM_SET,
    POP,
    PUSH, REF,
    RET,
    THREAD,
    TZ
} from './utils'
import Generate from './utils/lib/generate'
import {OPTTool} from './optimize/tool'
//指令4字节,3参数12字节,共16字节
export type slang_generate_visitor=(data:IRTree)=>Buffer
const CommandOffset=new Map<any,number>([
    [MOV,0],
    [REF,1],
    [JZ,2],
    [CZ,3],
    [TZ,4],
    [JMP,5],
    [CALL,6],
    [THREAD,7],
    [RET,8],
    [PUSH,9],
    [POP,10],
    [OFFSET_SET,11],
    [OFFSET_GET,12],
    [PARAM_LOAD,13],
    [PARAM_SET,14],
    [IN,15],
    [OUT,16],
    [GC,17],
    [DELETE,18],
    [INT,19],
    [INT_REGISTER,20],
    [INT_GET,21],
    [NOT,22],
    [BIT_NOT,23],
    [BINARY,24]
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
    ['xor',9],
    ['eq',10],
    ['grt',11],
    ['smr',12]
])
function offest(v1:IRArgs,v2:IRArgs,v3:IRArgs){
    return (v1.type=='value'?4:0)+(v2.type=='value'?2:0)+(v3.type=='value'?1:0)
}
function ins_id(data:IRTree,v1:IRArgs,v2:IRArgs,v3:IRArgs){
    let ins_offset:number=null
    for(const [key,value] of CommandOffset)
        if(data instanceof key)
            ins_offset=value
    const type_offset=data instanceof BINARY?BinaryOffset.get(data.id):0
    const v_offset=offest(v1,v2,v3)
    return (ins_offset+type_offset)*8+v_offset
}
function fill(data:IRTree,v1:IRArgs=null,v2:IRArgs=null,v3:IRArgs=null){
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
const G_MOV:slang_generate_visitor=(data:MOV)=>fill(data,data.left,data.right)
const G_REF:slang_generate_visitor=(data:REF)=>fill(data,data.left,data.right)
const G_JZ:slang_generate_visitor=(data:JZ)=>fill(data,data.target,data.frame,data.cond)
const G_CZ:slang_generate_visitor=(data:CZ)=>fill(data,data.target,data.frame,data.cond)
const G_TZ:slang_generate_visitor=(data:TZ)=>fill(data,data.target,data.frame,data.cond)
const G_JMP:slang_generate_visitor=(data:JMP)=>fill(data,data.target,data.frame)
const G_CALL:slang_generate_visitor=(data:CALL)=>fill(data,data.target,data.frame)
const G_THREAD:slang_generate_visitor=(data:THREAD)=>fill(data,data.target,data.frame)
const G_RET:slang_generate_visitor=(data:RET)=>fill(data,data.frame)
const G_PUSH:slang_generate_visitor=(data:PUSH)=>fill(data,data.target)
const G_POP:slang_generate_visitor=(data:POP)=>fill(data)
const G_OFFSET_SET:slang_generate_visitor=(data:OFFSET_SET)=>fill(data,data.target,data.offset,data.value)
const G_OFFSET_GET:slang_generate_visitor=(data:OFFSET_GET)=>fill(data,data.data,data.target,data.offset)
const G_PARAM_LOAD:slang_generate_visitor=(data:PARAM_LOAD)=>fill(data,data.data,data.param)
const G_PARAM_SET:slang_generate_visitor=(data:PARAM_SET)=>fill(data,data.param,data.value,data.value)
const G_IN:slang_generate_visitor=(data:IN)=>fill(data,data.oper,data.target)
const G_OUT:slang_generate_visitor=(data:OUT)=>fill(data,data.oper,data.target)
const G_GC:slang_generate_visitor=(data:GC)=>fill(data)
const G_DELETE:slang_generate_visitor=(data:DELETE)=>fill(data,data.data)
const G_INT:slang_generate_visitor=(data:INT)=>fill(data,data.data)
const G_INT_REGISTER:slang_generate_visitor=(data:INT_REGISTER)=>fill(data,data.block)
const G_INT_GET:slang_generate_visitor=(data:INT_GET)=>fill(data,data.left)
const G_NOT:slang_generate_visitor=(data:NOT)=>fill(data,data.left,data.right)
const G_BIT_NOT:slang_generate_visitor=(data:BIT_NOT)=>fill(data,data.left,data.right)
const G_BINARY:slang_generate_visitor=(data:BINARY)=>fill(data,data.result,data.left,data.right)
export default new Generate().use(new Map<any,slang_generate_visitor>([
    [MOV,G_MOV],
    [REF,G_REF],
    [JZ,G_JZ],
    [CZ,G_CZ],
    [TZ,G_TZ],
    [JMP,G_JMP],
    [CALL,G_CALL],
    [THREAD,G_THREAD],
    [RET,G_RET],
    [PUSH,G_PUSH],
    [POP,G_POP],
    [OFFSET_SET,G_OFFSET_SET],
    [OFFSET_GET,G_OFFSET_GET],
    [PARAM_LOAD,G_PARAM_LOAD],
    [PARAM_SET,G_PARAM_SET],
    [IN,G_IN],
    [OUT,G_OUT],
    [GC,G_GC],
    [DELETE,G_DELETE],
    [INT,G_INT],
    [INT_REGISTER,G_INT_REGISTER],
    [INT_GET,G_INT_GET],
    [NOT,G_NOT],
    [BIT_NOT,G_BIT_NOT],
    [BINARY,G_BINARY]
]))
.use((scope:OPTTool,call)=>{
    let head:Buffer[]=[]
    head.push(Buffer.from('SLANG','utf-8'),Buffer.from('bzx-ins1','utf-8'))
    let max_id=Buffer.alloc(8)
    max_id.writeBigUint64BE(BigInt(scope.index))
    head.push(max_id)
    let pool:Buffer[]=[]
    pool.push(Buffer.from('POOL_START','utf-8'))
    for(const data of scope.pool){
        let pool_data=Buffer.alloc(4)
        pool_data.writeUint32BE(data)
        pool.push(pool_data)
    }
    pool.push(Buffer.from('POOL_END','utf-8'))
    let code:Buffer[]=[]
    code.push(Buffer.from('CODE_START','utf-8'))
    for(const [number,data] of scope.code){
        let code_data:Buffer[]=[]
        code_data.push(Buffer.from('BLOCK_START','utf-8'))
        let id=Buffer.alloc(4)
        id.writeUint32BE(number)
        code_data.push(id)
        for(const ins of data)
            code_data.push(call(ins))
        code_data.push(Buffer.from('BLOCK_END','utf-8'))
        code.push(...code_data)
    }
    code.push(Buffer.from('CODE_END','utf-8'))
    return Buffer.concat([...head,...pool,...code])
})