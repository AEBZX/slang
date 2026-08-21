import {
    asm_factory, HAddressExpr, HArgumentsExpr,
    HArrayExpr, HAssign, HBinaryExpr, HBitNotExpr,
    HBooleanLiteral,
    HIdentifierExpr, HIfStatement, HIndexExpr, HLambdaExpr, HMapExpr, HMemberExpr, HMinusExpr, HNewExpr, HNotExpr,
    HNullLiteral,
    HNumberLiteral, HPostDecrementExpr, HPostIncrementExpr, HPreDecrementExpr, HPreIncrementExpr, HReferenceExpr,
    HStringLiteral, HTernaryExpr
} from '../utils'
const I_NumberLiteral:asm_factory=(data:HNumberLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value))
        id=tool.pool.get(data.value)
    else {
        id=tool.id()
        tool.pool.set(data.value,id)
    }
    tool.code.push(['load',['reg',name],['reg',id],['value',0]])
}
const I_StringLiteral:asm_factory=(data:HStringLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value))
        id=tool.pool.get(data.value)
    else {
        id=tool.id()
        tool.pool.set(data.value,id)
    }
    tool.code.push(['load',['reg',name],['reg',id],['value',0]])
}
const I_BooleanLiteral:asm_factory=(data:HBooleanLiteral,tool)=>{
    let name=tool.cache.pop()
    let id:number
    if(tool.pool.has(data.value?1:0))
        id=tool.pool.get(data.value?1:0)
    else {
        id=tool.id()
        tool.pool.set(data.value?1:0,id)
    }
    tool.code.push(['load',['reg',name],['reg',id],['value',0]])
}
const I_NullLiteral:asm_factory=(data:HNullLiteral,tool)=>{
    let id:number
    let name=tool.cache.pop()
    if(tool.pool.has('\0'))
        id=tool.pool.get('\0')
    else {
        id=tool.id()
        tool.pool.set('\0',id)
    }
    tool.code.push(['load',['reg',name],['reg',id],['value',0]])
}
const I_IdentifierExpr:asm_factory=(data:HIdentifierExpr,tool)=>{
    //变量id即存储槽,读变量:目标reg=变量的值
    tool.code.push(['mov',['reg',tool.cache.pop()],['value',data.name],['value',0]])
}
//offset [array/map] [index] [value]=>array/map[index]=value
//对象槽自引用(var[id]=id):对象句柄经赋值链存进变量槽,VM 的 value 形式对象访问靠它解析
const I_ArrayExpr:asm_factory=(data:HArrayExpr,tool)=>{
    let id=tool.cache.pop()
    tool.code.push(['mov',['reg',id],['reg',id],['value',0]])
    let index=0
    let ls=tool.id()
    let key_id=tool.id()
    for(let i of data.elements){
        //键也用数值的池id(value 形式),与 offset_get 的变量索引(value→var[x] 池id)一致
        //此前 offset_set 用 reg 数字键(0,1,2),offset_get 用池id,键错位导致 a[i] 读不到
        tool.cache.push(key_id)
        tool.gen(new HNumberLiteral(index))
        tool.cache.push(ls)
        tool.gen(i)
        tool.code.push(['offset_set',['value',id],['value',key_id],['value',ls]])
        index++
    }
}
const I_MapExpr:asm_factory=(data:HMapExpr,tool)=>{
    let id=tool.cache.pop()
    tool.code.push(['mov',['reg',id],['reg',id],['value',0]])
    let key_id=tool.id()
    let value_id=tool.id()
    for(let [k,v] of data.elements){
        tool.cache.push(key_id)
        tool.gen(new HStringLiteral(k))
        tool.cache.push(value_id)
        tool.gen(v)
        tool.code.push(['offset_set',['value',id],['value',key_id],['value',value_id]])
    }
}
const I_LambdaExpr:asm_factory=(data:HLambdaExpr,tool)=>{
    //入口main的lambda独占块id 0
    let block_id=tool.entry?0:tool.id()
    tool.entry=false
    //函数变量槽=块id常量,供call/引用解引用;原mov reg{id}=value{block_id}读未初始化槽,删除
    tool.gen(new HNumberLiteral(block_id))
    //代码生成;entry main的块id为0(根块),块已存在时不能重置,否则清空根块里其他函数的槽初始化
    if(!tool.asm.has(block_id))
        tool.asm.set(block_id,[[],data.params])
    else
        tool.asm.get(block_id)[1]=data.params
    tool.push(block_id)
    /**
     * 等价于:
     * param_load 参数1 固定参数注入区第一个元素
     * param_load 参数2 固定参数注入区第二个元素
     * ...
     * 0预留给return
     */
    for(let i=1;i<tool.param.length+1;i++)
        tool.code.push(['param_load',['reg',tool.param[i-1]],['reg',i],['value',0]])
    tool.gen(data.commands)
    tool.pop()
}
//offset value [array/map] [index] =>value=array/map[index]
const I_IndexExpr:asm_factory=(data:HIndexExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.index)
    //字符串索引 s[i]:独立 str_get 操作码(VM 按字符取子串、越界 null)。
    //不能用 offset_get:数组 owner 槽号与字符串池id同数字空间,VM 端无法区分
    if(data.is_string)
        tool.code.push(['str_get',['reg',id],['value',id],['value',index_id]])
    else
        tool.code.push(['offset_get',['reg',id],['value',id],['value',index_id]])
}
const I_MemberExpr:asm_factory=(data:HMemberExpr,tool)=>{
    let id=tool.cache.pop()
    let index_id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.cache.push(index_id)
    tool.gen(data.member)
    tool.code.push(['offset_get',['reg',id],['value',id],['value',index_id]])
}
//递增/递减:语句级(如 for 的 step fi++)调用者不压槽,gen 必须用独立临时槽并保持 cache 平衡
//此前直接 gen(data.target)(内部 cache.pop() 无配对 push),吞掉 while 压的条件块id,
//导致 continue 的 cache.pop() 拿到 0,jmp 到根块死循环
const I_PostfixIncrementExpr:asm_factory=(data:HPostIncrementExpr,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'+',new HNumberLiteral(1))))
}
const I_PrefixIncrementExpr:asm_factory=(data:HPreIncrementExpr,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'+',new HNumberLiteral(1))))
    tool.gen(data.target)
}
const I_PostfixDecrementExpr:asm_factory=(data:HPostDecrementExpr,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'-',new HNumberLiteral(1))))
}
const I_PrefixDecrementExpr:asm_factory=(data:HPreDecrementExpr,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(new HAssign(data.target,new HBinaryExpr(data.target,'-',new HNumberLiteral(1))))
    tool.gen(data.target)
}
const I_ArgumentsExpr:asm_factory=(data:HArgumentsExpr, tool)=>{
    //要call的区域的指针
    //cache 空(语句级调用,如 if 分支内的 out_ok()):pop 返回 undefined → 发射 a=undefined
    //(写盘时 u32 强制 0)指令引用 var[0],依赖前面误写的 var[0]=var[槽] 碰巧指向正确块,
    //布局一变就错;空 cache 时分配新槽
    let id=tool.cache.length>0?tool.cache.pop():tool.id()
    tool.cache.push(id)
    //成员方法调用 c.inc():param[1]=对象(this),实参从param[2]起
    //此前 this 参数不传,成员方法 param_load this 读到未设置值
    let obj_id:number|null=null
    if(data.target instanceof HMemberExpr){
        obj_id=tool.id()
        tool.cache.push(obj_id)
        tool.gen(data.target.target)
    }
    tool.gen(data.target)
    //栈帧:保存当前函数局部槽(跳过槽0返回值),返回后恢复——递归不再覆盖caller的槽
    let frame=tool.frame_push()
    //用于参数设置
    let ls_id=tool.id()
    let index=1
    if(obj_id!=null)
        tool.code.push(['param_set',['reg',index++],['value',obj_id],['value',0]])
    for(let i of data.args){
        tool.cache.push(ls_id)
        tool.gen(i)
        tool.code.push(['param_set',['reg',index++],['value',ls_id],['value',0]])
    }
    //将param全部压入栈(push用value压槽值,reg形式压的是槽号)
    for(let i=0;i<tool.param.length;i++)
        tool.code.push(['push',['value',tool.param[i]],['value',0],['value',0]])
    //拿到返回值
    tool.code.push(['call',['value',id],['reg',1],['value',0]])
    //出栈
    for(let i=tool.param.length-1;i>=0;i--)
        tool.code.push(['pop',['reg',tool.param[i]],['value',0],['value',0]])
    //恢复栈帧
    tool.frame_pop(frame)
    tool.code.push(['param_load',['reg',id],['reg',0],['value',0]])
}
//new:对象分配(自引用句柄)+this 经 param[1] 传入构造块,构造实参从 param[2] 起
//此前 NewPrefix 被忽略,new 降级为普通调用,无对象分配/this 传递,class 完全不可用
const I_NewExpr:asm_factory=(data:HNewExpr,tool)=>{
    let id=tool.cache.pop()          //结果槽=对象
    tool.cache.push(id)
    tool.code.push(['mov',['reg',id],['reg',id],['value',0]])   //对象自引用句柄 var[id]=id
    let target_id=tool.id()
    tool.cache.push(target_id)
    tool.gen(data.target)            //类槽→构造块id
    tool.code.push(['param_set',['reg',1],['value',id],['value',0]])   //this=对象
    let ls_id=tool.id()
    let index=2
    for(let i of data.args){
        tool.cache.push(ls_id)
        tool.gen(i)
        tool.code.push(['param_set',['reg',index++],['value',ls_id],['value',0]])
    }
    tool.code.push(['call',['value',target_id],['reg',1],['value',0]])
    //结果=对象(id 槽已自引用,构造块返回 this=对象)
}
const I_NotExpr:asm_factory=(data:HNotExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['not',['reg',id],['value',0],['value',0]])
}
const I_BitNotExpr:asm_factory=(data:HBitNotExpr, tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['bit_not',['reg',id],['value',0],['value',0]])
}
const I_MinusExpr:asm_factory=(data:HMinusExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.target)
    tool.code.push(['sub',['reg',id],['reg',0],['value',id]])
}
const I_ReferenceExpr:asm_factory=(data:HReferenceExpr,tool)=>{
    let id=tool.cache.pop()
    let ls=tool.id()
    tool.cache.push(ls)
    tool.gen(data.target)
    //读出id的内存地址赋值
    tool.code.push(['mov',['value',id],['value',ls],['value',0]])
}
const I_AddressExpr:asm_factory=(data:HAddressExpr,tool)=>{
    //变量id即存储槽,取地址=把变量id作为地址值赋给目标
    let id=tool.cache.pop()
    if(data.target instanceof HIdentifierExpr)
        tool.code.push(['mov',['reg',id],['reg',data.target.name],['value',0]])
    //索引/成员取地址:offset_addr返回槽地址,后续mov value解引用写入
    else if(data.target instanceof HIndexExpr){
        let index_id=tool.id()
        tool.cache.push(id)
        tool.gen(data.target.target)
        tool.cache.push(index_id)
        tool.gen(data.target.index)
        tool.code.push(['offset_addr',['reg',id],['value',id],['value',index_id]])
    }
    else if(data.target instanceof HMemberExpr){
        let index_id=tool.id()
        tool.cache.push(id)
        tool.gen(data.target.target)
        tool.cache.push(index_id)
        tool.gen(data.target.member)
        tool.code.push(['offset_addr',['reg',id],['value',id],['value',index_id]])
    }
    else {
        tool.cache.push(id)
        tool.gen(data.target)
        tool.code.push(['mov',['reg',id],['value',id],['value',0]])
    }
}
const I_BinaryExpr:asm_factory=(data:HBinaryExpr,tool)=>{
    let id=tool.cache.pop()
    tool.cache.push(id)
    tool.gen(data.left)
    let right_id=tool.id()
    tool.cache.push(right_id)
    tool.gen(data.right)
    //改为了a=b+c,更加好优化
    if(tool.BinaryDict.has(data.op))
        tool.code.push([tool.BinaryDict.get(data.op),['reg',id],['value',id],['value',right_id]])
    //==,!=,>=,<=,>,<
    if(tool.CmpDict.has(data.op))
        tool.code.push(['cmp',['reg',id],['value',right_id],['reg',tool.CmpDict.get(data.op)]])
    //&&,||
    if(data.op=='&&')
        tool.gen(new HIfStatement(
            new HBinaryExpr(id,'==',new HBooleanLiteral(false)),
            new HAssign(id,new HBooleanLiteral(false)),
            new HAssign(id,new HBinaryExpr(id,'&',right_id))
        ))
    if(data.op=='||')
        tool.gen(new HIfStatement(
            new HBinaryExpr(id,'==',new HBooleanLiteral(true)),
            new HAssign(id,new HBooleanLiteral(true)),
            new HAssign(id,new HBinaryExpr(id,'|',right_id))
        ))
}
const I_TernaryExpr:asm_factory=(data:HTernaryExpr,tool)=> {
    let id = tool.cache.pop()
    let cond = tool.id()
    let te = tool.id()
    let fe = tool.id()
    tool.cache.push(cond)
    tool.gen(data.condition)
    tool.cache.push(te)
    tool.gen(data.trueExpr)
    tool.cache.push(fe)
    tool.gen(data.falseExpr)
    tool.gen(new HIfStatement(
        new HBinaryExpr(id,'==',new HBooleanLiteral(true)),
        new HAssign(id,te),
        new HAssign(id,fe)
    ))
}
export default new Map<any,asm_factory>([
    [HNumberLiteral,I_NumberLiteral],
    [HStringLiteral,I_StringLiteral],
    [HBooleanLiteral,I_BooleanLiteral],
    [HNullLiteral,I_NullLiteral],
    [HIdentifierExpr,I_IdentifierExpr],
    [HArrayExpr,I_ArrayExpr],
    [HMapExpr,I_MapExpr],
    [HLambdaExpr,I_LambdaExpr],
    [HIndexExpr,I_IndexExpr],
    [HMemberExpr,I_MemberExpr],
    [HPostDecrementExpr,I_PostfixDecrementExpr],
    [HPostIncrementExpr,I_PostfixIncrementExpr],
    [HPreDecrementExpr,I_PrefixDecrementExpr],
    [HPreIncrementExpr,I_PrefixIncrementExpr],
    [HArgumentsExpr,I_ArgumentsExpr],
    [HNewExpr,I_NewExpr],
    [HNotExpr,I_NotExpr],
    [HBitNotExpr,I_BitNotExpr],
    [HMinusExpr,I_MinusExpr],
    [HReferenceExpr,I_ReferenceExpr],
    [HAddressExpr,I_AddressExpr],
    [HBinaryExpr,I_BinaryExpr],
    [HTernaryExpr,I_TernaryExpr]
])