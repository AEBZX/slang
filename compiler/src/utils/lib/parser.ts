import {ast_data, ast_generate, ast_rule, ast_rule_param, ASTTree, token, TokenType} from '../data'
import PeepholeTool, {PeepholeTree} from './tool'

class ParserStream{
    public pos:number
    public code:token[]
    public expected:{value:string,line:string,pos:number}=null
    constructor(code:token[]) {
        this.pos = 0
        //注释不参与语法
        this.code = code.filter(t => t.type !== TokenType.Comment)
    }
    public next():token{
        return this.code[this.pos++]||null
    }
    public now():token{
        return this.code[this.pos]||null
    }
    public peek():token{
        return this.code[this.pos+1]||null
    }
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
function loop_rule(name:string,data:ast_rule_param):ast_rule{
    return {
        type:'loop',
        name,
        data:[data]
    }
}

type rule_handler=(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream)=>ast_data|string|null

function parse_seg(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    const saved=stream.pos
    let child_num=0
    for(const rule of data.data){
        const value=parse(stream,rule,ref)
        if(value==null){
            stream.pos=saved
            return null
        }
        const is_delete=typeof rule=='object'&&rule!=null&&rule.type=='delete'
        if(is_delete){
            if(typeof value=='string')line.add(prev_line(stream))
            else for(const l of value.line)line.add(l)
            continue
        }
        if(typeof rule=='object'&&rule!=null&&rule.type=='choose'&&typeof value=='object'&&value.children.size==0&&value.type==null)continue
        ret.children.set(child_num,value)
        if(typeof value=='string')line.add(prev_line(stream))
        else for(const l of value.line)line.add(l)
        child_num++
    }
    ret.line=[...line]
    return ret
}
function parse_delete(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    //delete 是一串必须按顺序匹配的字面量
    return parse(stream,{...data,type:'seg'},ref)
}
function parse_child(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    const parser=parse(stream,{...data,type:'seg'},ref)
    if(parser==null||typeof parser=='string')return null
    for(const res of parser.children.values())
        if(res!=null&&typeof res=='object'){
            ret=res
            break
        }
    return ret
}
function parse_or(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    for(const rule of data.data){
        const saved=stream.pos
        const value=parse(stream,rule,ref)
        if(value!=null)return value
        stream.pos=saved
    }
    return null
}
function parse_choose(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data|string=null
    const saved=stream.pos
    for(const rule of data.data){
        const value=parse(stream,rule,ref)
        if(value==null){
            stream.pos=saved
            return {type:data.name,children:new Map(),line:[]}
        }
        if(typeof rule=='object'&&rule!=null&&rule.type=='delete')continue
        ret=value
    }
    return ret as ast_data
}
function parse_call(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    const rule=ref.get(data.name)
    if(rule==null)throw new Error('规则未定义:'+data.name)
    return parse(stream,rule,ref)
}
function parse_while(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    const item=data.data[0]
    const split=data.data[1]
    let param_num=0
    //第一项可选:零次匹配视为循环 0 次
    let saved=stream.pos
    let child=parse(stream,item,ref)
    if(child==null){
        stream.pos=saved
        ret.line=[...line]
        return ret
    }
    ret.children.set(param_num,child)
    if(typeof child=='string')line.add(prev_line(stream))
    else for(const l of child.line)line.add(l)
    param_num++
    while(true){
        saved=stream.pos
        const sep=parse(stream,split,ref)
        if(sep==null){
            stream.pos=saved
            break
        }
        child=parse(stream,item,ref)
        if(child==null){
            stream.pos=saved
            break
        }
        ret.children.set(param_num,child)
        if(typeof child=='string')line.add(prev_line(stream))
        else for(const l of child.line)line.add(l)
        param_num++
    }
    ret.line=[...line]
    return ret
}
function parse_loop(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    const ret:ast_data={type:data.name,children:new Map(),line:[]}
    const line:Set<string>=new Set()
    let param_num=0
    while(true){
        const saved=stream.pos
        const child=parse(stream,data.data[0],ref)
        if(child==null){
            stream.pos=saved
            break
        }
        ret.children.set(param_num,child)
        if(typeof child=='string')line.add(prev_line(stream))
        else for(const l of child.line)line.add(l)
        param_num++
    }
    ret.line=[...line]
    return ret
}
const parse_table:Record<string,rule_handler>={
    seg:parse_seg,
    delete:parse_delete,
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
            if(stream.expected==null||stream.pos>=stream.expected.pos)stream.expected={value:String(data),line:now_line(stream),pos:stream.pos}
            return null
        }
        case 'object':{
            const handler=parse_table[data.type]
            if(handler==null)throw new Error('未知规则类型:'+data.type)
            return handler(data,ref,stream)
        }
        default:{
            const now=stream.now()
            if(now&&now.type==data){
                stream.next()
                return now.value
            }
            if(stream.expected==null||stream.pos>=stream.expected.pos)stream.expected={value:TokenType[data],line:now_line(stream),pos:stream.pos}
            return null
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
        if(cst==null||typeof cst=='string'){
            const want=stream.expected
            throw new Error(want==null?'无法解析语法,在'+now_line(stream):`无法找到${want.value}在${want.line}`)
        }
        //parser 不做错误恢复:规则结束后还有 token 就是语法错误
        if(stream.now()!=null)
            throw new Error('未解析的 token: '+stream.now().value+'在'+now_line(stream))
        return this.generate(cst)
    }
    run(code:token[][]):PeepholeTree[]{
        return code.map(c=>this._run(c))
    }
}
export const $={
    s:seg_rule,
    d:delete_rule,
    t:child_rule,
    o:or_rule,
    c:choose_rule,
    r:call_rule,
    w:while_rule,
    l:loop_rule
}