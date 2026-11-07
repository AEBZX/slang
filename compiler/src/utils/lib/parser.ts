import {ast_data, ast_generate, ast_rule, ast_rule_param, ASTTree, token, TokenType} from '../data'
import PeepholeTool, {PeepholeTree} from './tool'
import ast from "../../parser/ast";

class ParserStream{
    public pos:number
    public code:token[]
    public record:number[]=[]
    constructor(code:token[]) {
        this.pos = 0
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
    public backup(){
        this.record.push(this.pos)
    }
    public restore(){
        this.pos=this.record.pop()||0
    }
    public lost(){
        this.record.pop()
    }
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
function parse_seg(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    let line:Set<string>=new Set()
    stream.backup()
    for(const [i,rule] of data.data.entries()){
        const data=parse(stream,rule,ref)
        if(data==null){
            stream.restore()
            throw new Error(`无法解析${typeof rule=='string'?rule: (<ast_rule>rule).name}在${stream.now().line}`)
        }
        if(typeof rule!='string'&& (<ast_rule>rule).type=='delete')
            continue
        if(typeof data=='object')
            for(const _line of data.line)
                line.add(_line)
        else line.add(stream.now().line)
        ret.children.set(i,data)
    }
    ret.line=[...line]
    return ret
}
function parse_delete(data:ast_rule,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    return parse(stream,{...data,type:'seg'},ref) as ast_data
}
function parse_child(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    //同上,传副本
    const parser=parse(stream,{...data,type:'seg'},ref)
    for(const res of (parser as ast_data).children.values())
        if(res!=null&&typeof res=='object'){
            ret=res
            break
        }
    return ret
}
function parse_or(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string{
    let ret:ast_data|string=null
    let res:ast_data|string
    for(const rule of data.data){
        res=parse(stream,rule,ref) as ast_data
        if(res!=null){
            ret=res
            break
        }
    }
    return ret
}
function parse_choose(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data|string {
    const parser=parse(stream,{...data,type:'seg'},ref)
    if(parser!=null)return parser
    return null
}
function parse_call(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    return parse(stream,ref.get(data.name),ref) as ast_data
}
function parse_while(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    let line:Set<string>=new Set()
    const parse_data=data.data[0]
    const parse_split=data.data[1]
    //try
    const try_parse=parse(stream,parse_data,ref)
    if(try_parse==null)return ret
    ret.children.set(0,try_parse)
    let index=1
    let while_data,while_split:ast_data|string
    while(true){
        while_split=parse(stream,parse_split,ref)
        if(while_split==null){
            ret.line.push(...line)
            return ret
        }
        if(typeof while_split=='object')
            for(const _line of while_split.line)
                line.add(_line)
        else line.add(stream.now().line)
        while_data=parse(stream,parse_data,ref)
        if(while_data==null)return null
        ret.children.set(index,while_data)
        if(typeof while_data=='object')
            for(const _line of while_data.line)
                line.add(_line)
        else line.add(stream.now().line)
        index++
    }
}
function parse_loop(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data {
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    let line:Set<string>=new Set()
    let param_num=0
    const parse_data=data.data[0]
    let loop_data:ast_data|string
    while(true){
        loop_data=parse(stream,parse_data,ref)
        if(loop_data==null){
            ret.line=[...line]
            return ret
        }
        if(typeof loop_data=='object')
            for(const _line of loop_data.line)
                line.add(_line)
        else line.add(stream.now().line)
    }
}
const parse_table=new Map<string,any>([
    ['seg',parse_seg],
    ['delete',parse_delete],
    ['child',parse_child],
    ['or',parse_or],
    ['choose',parse_choose],
    ['call',parse_call],
    ['while',parse_while],
    ['loop',parse_loop]
])
function parse(stream:ParserStream,data:ast_rule_param,ref:Map<string,ast_rule>):ast_data|string{
    let child_num=0
    switch (typeof data){
        case 'string':{
            const now=stream.now()
            if(now&&now.value==data){
                const ret=now.value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${data}在${stream.now().line}`)
        }
        case 'object':
            return parse_table.get(data.type)(data,child_num,ref,stream)
        default:{
            const now=stream.now()
            if(now&&now.type==data){
                const ret=now.value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${TokenType[data as TokenType]}在${stream.now().line}`)
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
            for(let [k,v] of rule)
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
        let fn=this.ref.has(name)?this.ref.get(name):this._default
        if(fn==null)
            throw new Error('AST 生成器缺失:'+name)
        return fn
    }
    private generate=(data:ast_data):PeepholeTree=>{
        let node=this.call(data.type)(data,this.generate)
        if(node instanceof ASTTree&&(node.line==null||node.line.length==0))
            node.line=data.line
        return node
    }
    _run(code:token[]){
        let entry='entry'
        let rule=this.parse.find(r=>r.name==entry)||this.parse.find(r=>r.name=='File')||this.parse[0]
        if(!rule)
            throw new Error('入口规则不存在')
        let stream=new ParserStream(code)
        let cst=parse(stream,rule,
            new Map(this.parse.map(r=>[r.name,r])))
        if(typeof cst=='string')throw new Error('解析出的头为字符串而非AST对象,请检查您的编译器插件')
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