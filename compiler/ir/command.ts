import {
    asm_factory,
    HAddressExpr,
    HAssign,
    HBreak,
    HCall,
    HContinue, HIfStatement, HListCommand,
    HNumberLiteral,
    HReturn,
    HThread,
    HVM, HWhileStatement
} from '../utils'
const I_Assign:asm_factory=(data:HAssign,tool)=>{
    let left_id=tool.id()
    let right_id=tool.id()
    tool.cache.push(left_id)
    //left_id=&a
    tool.gen(new HAddressExpr(data.data))
    tool.cache.push(right_id)
    tool.gen(data.value)
    //*left_id=right
    tool.code.push(['mov',['value',left_id],['value',right_id],['value',0]])
}
const I_Call:asm_factory=(data:HCall,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(data.data)
    //栈帧:调用前保存当前函数全部局部槽,返回后恢复——递归时callee不再覆盖caller的槽(槽0返回值除外)
    let frame=tool.frame_push()
    //填充参数
    let index=1
    let ls_data=tool.id()
    for(let i of data.args){
        tool.cache.push(ls_data)
        tool.gen(i)
        tool.code.push(['param_set',['reg',index++],['value',ls_data],['value',0]])
    }
    //将param全部压入栈(push用value压槽值,reg形式压的是槽号)
    for(let i=0;i<tool.param.length;i++)
        tool.code.push(['push',['value',tool.param[i]],['value',0],['value',0]])
    tool.code.push(['call',['value',id],['reg',1],['value',0]])
    for(let i=tool.param.length-1;i>=0;i--)
        tool.code.push(['pop',['reg',tool.param[i]],['value',0],['value',0]])
    //恢复栈帧
    tool.frame_pop(frame)
}
const I_Thread:asm_factory=(data:HThread,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(data.data)
    //线程调用同样保护调用者局部槽(callee在独立线程运行,返回后恢复)
    let frame=tool.frame_push()
    //填充参数
    let index=1
    let ls_data=tool.id()
    for(let i of data.args){
        tool.cache.push(ls_data)
        tool.gen(i)
        tool.code.push(['param_set',['reg',index++],['value',ls_data],['value',0]])
    }
    //将param全部压入栈(push用value压槽值,reg形式压的是槽号)
    for(let i=0;i<tool.param.length;i++)
        tool.code.push(['push',['value',tool.param[i]],['value',0],['value',0]])
    tool.code.push(['thread',['value',id],['reg',1],['value',0]])
    for(let i=tool.param.length-1;i>=0;i--)
        tool.code.push(['pop',['reg',tool.param[i]],['value',0],['value',0]])
    //恢复栈帧
    tool.frame_pop(frame)
}
const I_Break:asm_factory=(data:HBreak,tool)=>{
    tool.code.push(['ret',['value',0],['value',0],['value',0]])
}
const I_Continue:asm_factory=(data:HContinue,tool)=>{
    let continue_block=tool.cache.pop()
    tool.code.push(['jmp',['reg',continue_block],['reg',1],['value',0]])
}
const I_VM:asm_factory=(data:HVM, tool)=>{
    let commands=data.data.split(' ')
    let head=commands.shift()
    let _data:['reg'|'value',number][]=[]
    for(let i of commands)
        _data.push(['value',parseInt(i.replace('%',''))])
    if(tool.code.length>3)
        for(let i=0;i<tool.code.length-3;i++)
            _data.push(['value',0])
    if(tool.code.length>3)_data=_data.slice(0,3)
    tool.code.push([head,_data[0],_data[1],_data[2]])
}
const I_Return:asm_factory=(data:HReturn,tool)=>{
    let id=tool.id()
    tool.cache.push(id)
    tool.gen(data.data)
    tool.code.push(['param_set',['reg',0],['value',id],['value',0]])
    //retn=弹到函数帧:if/while分支内return不再被块帧截断(此前ret只弹一帧,函数体继续执行)
    tool.code.push(['retn',['value',0],['value',0],['value',0]])
}
const I_IfStatement:asm_factory=(data:HIfStatement,tool)=>{
    let tb=tool.id()
    let fb=tool.id()
    let cond=tool.id()
    let _cond=tool.id()
    tool.cache.push(cond)
    tool.gen(data.condition)
    tool.code.push(['cmp',['reg',cond],['reg',1],['reg',tool.CmpDict.get('==')]])
    tool.code.push(['mov',['reg',_cond],['value',cond],['value',0]])
    tool.code.push(['cmp',['reg',_cond],['reg',0],['reg',tool.CmpDict.get('==')]])
    //cz=块调用(压块帧),区别于call(函数帧);return(RE TN)弹到函数帧,不被cz帧截断
    tool.code.push(['cz',['reg',tb],['value',cond],['value',0]])
    tool.code.push(['cz',['reg',fb],['value',_cond],['value',0]])
    tool.push(tb)
    tool.gen(data.commands)
    tool.pop()
    tool.push(fb)
    tool.gen(data.else_)
    tool.pop()
}
const I_WhileStatement:asm_factory=(data:HWhileStatement,tool)=>{
    let id=tool.id()
    //cz=块调用(压块帧),条件恒真即无条件进入条件块;不用call以免retn误当函数帧
    tool.code.push(['cz',['reg',id],['reg',1],['value',0]])
    tool.push(id)
    tool.cache.push(id)
    //循环体末尾追加跳回条件块,实现多次循环(原循环体执行后直接退出,仅循环一次)
    let body=data.commands instanceof HListCommand?data.commands.commands:[data.commands]
    tool.gen(new HIfStatement(
        data.condition,
        new HListCommand([...body,new HContinue()]),
        new HBreak()
    ))
    tool.pop()
}
const I_ListCommand:asm_factory=(data:HListCommand,tool)=>{
    for(let i of data.commands)
        tool.gen(i)
}
export default new Map<any,asm_factory>([
    [HAssign,I_Assign],
    [HCall,I_Call],
    [HThread,I_Thread],
    [HBreak,I_Break],
    [HContinue,I_Continue],
    [HVM,I_VM],
    [HReturn,I_Return],
    [HIfStatement,I_IfStatement],
    [HWhileStatement,I_WhileStatement],
    [HListCommand,I_ListCommand]
])