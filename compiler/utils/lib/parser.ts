import {ast_data, ast_generate, ast_rule, ast_rule_param, ASTTree, token, TokenType} from '../data'
import PeepholeTool, {PeepholeTree} from './tool'

class ParserStream{
    public pos:number
    public code:token[]
    constructor(code:token[]) {
        this.pos = 0
        //注释 token 不参与解析(lexer 产出 Comment 供工具用,parser 必须跳过,
        //否则任何注释都导致整文件解析失败——此前从未有带注释的程序被编译过)
        this.code = code.filter(t => t.type !== TokenType.Comment)
    }
    public next():token{
        return this.code[this.pos++]
    }
    public now():token{
        return this.code[this.pos]
    }
    public peek():token{
        return this.code[this.pos+1]
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
//返回第一个不是delete_rule的
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
function now_line(stream:ParserStream):string{
    let now=stream.now()
    return now?now.line:'EOF'
}
function parse_seg(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ls,ret:ast_data={type:data.name,children:new Map(),line:[]},line:Set<string>=new Set()
    for(let i of data.data){
        ls=parse(stream,i,ref)
        if(ls!=null){
            if(typeof ls=='string'){
                ret.children.set(child_num,ls)
                line.add(stream.code[stream.pos-1].line)
            }
            if(typeof ls=='object'){
                ret.children.set(child_num,ls)
                for(let j of (ls as ast_data).line)line.add(j)
            }
            child_num++
        }
    }
    ret.line=[...line]
    return ret
}
function parse_delete(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    try{
        return parse(stream,{...data,type:'seg'},ref) as ast_data
    }catch (e){
        return null
    }
}
function parse_child(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ls,ret:ast_data={type:data.name,children:new Map(),line:[]}
    //同上,传副本
    ls=parse(stream,{...data,type:'seg'},ref)
    for(let [name,i] of (ls as ast_data).children)
        if(i!=null&&typeof i=='object')
            ret=i
    return ret
}
function parse_or(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ls,ret:ast_data={type:data.name,children:new Map(),line:[]}
    let ok=false
    for(let i of data.data){
        let saved=stream.pos
        try{
            ls=parse(stream,i,ref)
            if(ls!=null){
                ok=true
                ret=ls
                break
            }
        }catch (e) {
            stream.pos=saved
        }
    }
    let a=[]
    for(let i of data.data)a.push(typeof i=='string'?i:typeof i=='object'?i.name:TokenType[i])
    if(!ok)throw new Error(`无法找到${a.join(' ')}中的任意一条规则在${now_line(stream)}`)
    return ret
}
function parse_choose(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data {
    let ls:ast_data
    let saved = stream.pos
    try {
        for (let i of data.data)
            ls =<ast_data> parse(stream, i, ref)
        if (ls != null) return ls
    } catch (e) {
    }
    stream.pos = saved
    return null
}
function parse_call(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    return parse(stream,ref.get(data.name),ref) as ast_data
}
function parse_while(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data{
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    let line:Set<string>=new Set()
    let ls
    let param_num=0
    let saved=stream.pos
    try{
        let child=parse(stream,data.data[0],ref)
        ret.children.set(param_num,child)
        if(typeof child=='string')
            line.add(stream.code[stream.pos-1].line)
        if(typeof child=='object')
            for(let j of (child as ast_data).line)line.add(j)
        param_num++
    }catch (e) {
        stream.pos=saved
    }
    //零次匹配视为循环0次
    if(param_num==0)return{
        type:data.name,
        children:new Map(),
        line:[...line]
    }
    while(true){
        saved=stream.pos
        try{
            ls=parse(stream,data.data[1],ref)
            let child=parse(stream,data.data[0],ref)
            ret.children.set(param_num,child)
            if(typeof child=='string')
                line.add(stream.code[stream.pos-1].line)
            if(typeof child=='object')
                for(let j of (child as ast_data).line)line.add(j)
            param_num++
        }catch (e) {
            stream.pos=saved
            break
        }
    }
    ret.line=[...line]
    return ret
}
function parse_loop(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data {
    let ret:ast_data={type:data.name,children:new Map(),line:[]}
    let line:Set<string>=new Set()
    let param_num=0
    while(true){
        let saved=stream.pos
        try{
            let child=parse(stream,data.data[0],ref)
            ret.children.set(param_num,child)
            if(typeof child=='string')
                line.add(stream.code[stream.pos-1].line)
            if(typeof child=='object')
                for(let j of (child as ast_data).line)line.add(j)
        }catch (e){
            stream.pos=saved
            break
        }
        param_num++
    }
    ret.line=[...line]
    return ret
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
            let now=stream.now()
            if(now&&now.value==data){
                let ret=now.value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${data}在${now_line(stream)}`)
        }
        case 'object':
            return parse_table.get(data.type)(data,child_num,ref,stream)
        default:{
            let now=stream.now()
            if(now&&now.type==data){
                let ret=now.value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${TokenType[data as TokenType]}在${now_line(stream)}`)
        }
    }
}
export default class Parser extends PeepholeTool{
    ref:Map<string,ast_generate>
    _default:ast_generate
    parse:ast_rule[]
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
        if(!this.ref.has(name))
            return this._default
        return this.ref.get(name)
    }
    private generate(data:ast_data):PeepholeTree{
        return this.call(data.type)(data,this.generate)
    }
    _run(code:token[]){
        let entry='entry'
        if(!this.parse.some(r=>r.name==entry))
            throw new Error('入口规则不存在')
        let cst=parse(new ParserStream(code),this.parse.find(r=>r.name==entry),
            new Map(this.parse.map(r=>[r.name,r])))
        if(typeof cst=='string')throw new Error('解析出的头为字符串而非AST对象,请检查您的编译器插件')
        return this.generate(cst)
    }
    run(code:token[][]):PeepholeTree[]{
        return code.map(this._run)
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