import {ast_data, ast_generate, ast_rule, ast_rule_param, ASTTree, token, TokenType} from '../data'
import PeepholeTool, {PeepholeTree} from './tool'

class ParseError extends Error{
    constructor(message:string) {
        super(message)
        this.name='ParseError'
    }
}

class ParserStream{
    public pos:number
    public code:token[]
    //回溯会吞掉异常:记下最深的一次失败,报错时才有可读位置
    public deep:{pos:number,error:Error}=null
    //泛型闭合的 > 可能和 >=/>>/>>= 粘在同一个 token 里:
    //切出来的剩余部分放在这个位置,等下一次 now() 读
    public override:{pos:number,token:token}=null
    constructor(code:token[]) {
        this.pos = 0
        //注释不参与语法
        this.code = code.filter(t => t.type !== TokenType.Comment)
    }
    public next():token{
        return this.code[this.pos++]||null
    }
    public now():token{
        if(this.override!=null&&this.override.pos===this.pos)return this.override.token
        return this.code[this.pos]||null
    }
    public peek():token{
        return this.code[this.pos+1]||null
    }
    public checkpoint():{pos:number,override:{pos:number,token:token}}{
        return {pos:this.pos,override:this.override}
    }
    public restore(ck:{pos:number,override:{pos:number,token:token}}){
        this.pos=ck.pos
        this.override=ck.override
    }
    //把当前位置 token 的首字符切出来,剩余部分留在原地供下一次匹配
    public split(head:string):string{
        const now=this.now()
        if(now==null||!now.value.startsWith(head))throw new ParseError(`无法切出${head}在${now_line(this)}`)
        const rest=now.value.slice(head.length)
        this.override=rest===''?null:{pos:this.pos,token:{...now,value:rest}}
        if(rest==='')this.pos++
        return head
    }
    public note_error(error:Error){
        if(this.deep==null||this.pos>=this.deep.pos)this.deep={pos:this.pos,error}
    }
}
//报错位置:Eof 时也要能给出可读信息,不能直接解引用 null
function parse_error(stream:ParserStream,message:string):ParseError{
    const error=new ParseError(message)
    stream.note_error(error)
    return error
}
function now_line(stream:ParserStream):string{
    const now=stream.now()
    return now?now.line:'EOF'
}
function prev_line(stream:ParserStream):string{
    const prev=stream.code[stream.pos-1]
    return prev?prev.line:now_line(stream)
}
function seg_rule(name:string,...data:ast_rule_param[]):ast_rule{
    return {
        type:'seg',
        name,data
    }
}
//仅占位
function delete_rule(...data:ast_rule_param[]):ast_rule{
    return {
        type:'delete',
        name:null,data
    }
}
function child_rule(...data:ast_rule_param[]):ast_rule{
    return {
        type:'child',
        name:null,data
    }
}
function or_rule(name:string,...data:ast_rule_param[]):ast_rule{
    return {
        type:'or',
        name,data
    }
}
function choose_rule(...data:ast_rule_param[]):ast_rule{
    return {
        type:'choose',
        name:null,data
    }
}
function call_rule(name:string):ast_rule{
    return {
        type:'call',
        name,
        data:null
    }
}
function while_rule(name:string,data:ast_rule_param,split:ast_rule_param):ast_rule{
    return {
        type:'while',
        name,
        data:[data,split]
    }
}
function split_rule(head:string='>'):ast_rule{
    return {
        type:'split',
        name:null,
        data:[head]
    }
}
function loop_rule(name:string,data:ast_rule_param):ast_rule{
    return {
        type:'loop',
        name,
        data:[data]
    }
}

type rule_handler=(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream)=>ast_data|string

function parse_seg(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    for(const rule of data.data){
        const value=parse(stream,rule,ref)
        const is_delete=typeof rule=='object'&&rule!=null&&(rule.type=='delete'||rule.type=='split')
        if(is_delete){
            //delete 只做字面量匹配,不占用 child 序号
            if(typeof value=='string')line.add(prev_line(stream))
            else if(value!=null)for(const l of value.line)line.add(l)
            continue
        }
        if(value==null)continue
        ret.children.set(child_num,value)
        if(typeof value=='string')line.add(prev_line(stream))
        else for(const l of value.line)line.add(l)
        child_num++
    }
    ret.line=[...line]
    return ret
}
function parse_delete(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    //delete 可能是一串必须按顺序匹配的字面量,统一当 seg 处理
    return parse(stream,{...data,type:'seg'},ref)
}
function parse_child(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    const parser=parse(stream,{...data,type:'seg'},ref)
    if(typeof parser=='string')return ret
    //child 取第一个对象子节点(包装用的 seg 本身不返回)
    for(const res of parser.children.values())
        if(res!=null&&typeof res=='object'){
            ret=res
            break
        }
    return ret
}
function parse_split(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):string{
    return stream.split(data.data[0] as string)
}
function parse_or(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    const saved=stream.checkpoint()
    for(const rule of data.data){
        try{
            return parse(stream,rule,ref)
        }catch (e){
            //只吞"不匹配"的 ParseError;真正的代码 bug 继续向上抛
            if(!(e instanceof ParseError))throw e
            stream.note_error(e)
            stream.restore(saved)
        }
    }
    const names=data.data.map(i=>typeof i=='string'?i:typeof i=='object'&&i!=null?i.name:TokenType[i as TokenType])
    throw parse_error(stream,`无法找到${names.join(' ')}中的任意一条规则在${now_line(stream)}`)
}
function parse_choose(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const saved=stream.checkpoint()
    try{
        let ret:ast_data|string=null
        for(const rule of data.data){
            const value=parse(stream,rule,ref)
            //delete 只做字面量匹配,不能当 choose 的结果;其余项继续消费
            if(typeof rule=='object'&&rule!=null&&(rule.type=='delete'||rule.type=='split'))continue
            ret=value
        }
        if(ret!=null)return ret as ast_data
    }catch (e){
        if(!(e instanceof ParseError))throw e
        stream.note_error(e)
    }
    stream.restore(saved)
    return null
}
function parse_call(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    const rule=ref.get(data.name)
    if(rule==null)throw parse_error(stream,`规则未定义:${data.name}在${now_line(stream)}`)
    return parse(stream,rule,ref)
}
function parse_while(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    const item=data.data[0]
    const split=data.data[1]
    let param_num=0
    //第一项可选:零次匹配视为循环 0 次
    let saved=stream.checkpoint()
    try{
        const child=parse(stream,item,ref)
        ret.children.set(param_num,child)
        if(typeof child=='string')line.add(prev_line(stream))
        else for(const l of child.line)line.add(l)
        param_num++
    }catch (e){
        if(!(e instanceof ParseError))throw e
        stream.note_error(e)
        stream.restore(saved)
        ret.line=[...line]
        return ret
    }
    while(true){
        saved=stream.checkpoint()
        try{
            parse(stream,split,ref)
            const child=parse(stream,item,ref)
            //分隔符吃掉了却没消费新 token,说明规则会自循环,直接收尾
            if(stream.pos==saved)break
            ret.children.set(param_num,child)
            if(typeof child=='string')line.add(prev_line(stream))
            else for(const l of child.line)line.add(l)
            param_num++
        }catch (e){
            if(!(e instanceof ParseError))throw e
            stream.note_error(e)
            stream.restore(saved)
            break
        }
    }
    ret.line=[...line]
    return ret
}
function parse_loop(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    let param_num=0
    while(true){
        const saved=stream.checkpoint()
        try{
            const child=parse(stream,data.data[0],ref)
            if(stream.pos==saved)break
            ret.children.set(param_num,child)
            if(typeof child=='string')line.add(prev_line(stream))
            else for(const l of child.line)line.add(l)
            param_num++
        }catch (e){
            if(!(e instanceof ParseError))throw e
            stream.note_error(e)
            stream.restore(saved)
            break
        }
    }
    ret.line=[...line]
    return ret
}
const parse_table:Record<string,rule_handler>={
    seg:parse_seg,
    delete:parse_delete,
    split:parse_split,
    child:parse_child,
    or:parse_or,
    choose:parse_choose,
    call:parse_call,
    while:parse_while,
    loop:parse_loop
}
function parse(stream:ParserStream,data:ast_rule_param,ref:Map<string,ast_rule>):ast_data|string{
    switch (typeof data){
        case 'string':{
            const now=stream.now()
            if(now&&now.value==data){
                stream.next()
                return now.value
            }
            throw parse_error(stream,`无法找到${data}在${now_line(stream)}`)
        }
        case 'object':{
            const handler=parse_table[data.type]
            if(handler==null)throw parse_error(stream,`未知规则类型${data.type}在${now_line(stream)}`)
            return handler(data,0,ref,stream)
        }
        default:{
            const now=stream.now()
            if(now&&now.type==data){
                stream.next()
                return now.value
            }
            throw parse_error(stream,`无法找到${TokenType[data]}在${now_line(stream)}`)
        }
    }
}
export default class Parser extends PeepholeTool{
    ref:Map<string,ast_generate>=new Map()
    _default:ast_generate=null
    parse:ast_rule[]=[]
    constructor() {
        super('parser')
    }
    use(rule:Map<string,ast_generate>|ast_generate|ast_rule[]|ast_rule){
        if(rule instanceof Map)
            for(const [k,v] of rule)
                this.ref.set(k,v)
        else if(Array.isArray(rule))
            this.parse.push(...rule)
        else if('data' in rule){
            rule.name='entry'
            this.parse.push(rule)
        }else this._default=rule
        return this
    }
    private call(name:string){
        const fn=this.ref.has(name)?this.ref.get(name):this._default
        if(fn==null)
            throw new Error('AST 生成器缺失:'+name)
        return fn
    }
    private generate=(data:ast_data):PeepholeTree=>{
        const node=this.call(data.type)(data,this.generate)
        if(node instanceof ASTTree&&(node.line==null||node.line.length==0))
            node.line=data.line
        return node
    }
    _run(code:token[]){
        const rule=this.parse.find(r=>r.name=='entry')||this.parse.find(r=>r.name=='File')||this.parse[0]
        if(!rule)
            throw new Error('入口规则不存在')
        const stream=new ParserStream(code)
        const cst=parse(stream,rule,new Map(this.parse.map(r=>[r.name,r])))
        if(typeof cst=='string')throw new ParseError('解析出的头为字符串而非AST对象,请检查您的编译器插件')
        //parser 不做错误恢复:规则结束后还有 token 就是语法错误
        if(stream.now()!=null){
            const extra=stream.deep==null?'':`\n最内层失败: ${stream.deep.error.message}`
            throw new ParseError(`未解析的 token: ${stream.now().value}在${now_line(stream)}${extra}`)
        }
        return this.generate(cst)
    }
    run(code:token[][]):PeepholeTree[]{
        return code.map(c=>this._run(c))
    }
}
export const $={
    s:seg_rule,
    d:delete_rule,
    g:split_rule,
    t:child_rule,
    o:or_rule,
    c:choose_rule,
    r:call_rule,
    w:while_rule,
    l:loop_rule
}