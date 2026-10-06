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
        //delete 规则是"必须匹配的字面量":匹配后只消费 token 并收集行号,不占用 child 序号。
        //此前它作为 ast_data 写进 children,导致后续生成器按 child 序号取节点全部错位
        let is_delete=typeof i=='object'&&i!=null&&(i as ast_rule).type=='delete'
        ls=parse(stream,i,ref)
        if(is_delete){
            if(typeof ls=='string')
                line.add(stream.code[stream.pos-1].line)
            else if(ls!=null)
                for(let j of (ls as ast_data).line)line.add(j)
            continue
        }
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
    return parse(stream,{...data,type:'seg'},ref) as ast_data
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
            if((globalThis as any).__DEBUG_PARSE)console.error('[or]',data.name,'| branch:',typeof i=='object'?i.name:i,'| msg:',(e as Error).message)
        }
    }
    let a=[]
    for(let i of data.data)a.push(typeof i=='string'?i:typeof i=='object'?i.name:TokenType[i])
    if(!ok)throw new Error(`无法找到${a.join(' ')}中的任意一条规则在${now_line(stream)}`)
    return ret
}
function parse_choose(data:ast_rule,child_num:number,ref:Map<string,ast_rule>,stream:ParserStream):ast_data {
    let ls:ast_data=null
    let saved = stream.pos
    try {
        for (let i of data.data){
            let ret=parse(stream, i, ref)
            //delete 只做字面量匹配,不能作为 choose 的结果返回
            //(否则 choose(d('<'),...,d('>')) 会把 '>' 的包装对象当结果,泛型列表丢失)
            if(typeof i=='object'&&i!=null&&(i as ast_rule).type=='delete')continue
            ls =<ast_data> ret
        }
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
            if(stream.pos==saved)break
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
            if(stream.pos==saved)break
            ret.children.set(param_num,child)
            if(typeof child=='string')
                line.add(stream.code[stream.pos-1].line)
            if(typeof child=='object')
                for(let j of (child as ast_data).line)line.add(j)
        }catch (e){
            stream.pos=saved
            if((globalThis as any).__DEBUG_PARSE)console.error('[loop]',(e as Error).message,'| rule:',data.name)
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
            if((globalThis as any).__DEBUG_PARSE)console.error('[str fail]',data,'| now:',now&&now.value,'| pos:',stream.pos)
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
            if((globalThis as any).__DEBUG_PARSE)console.error('[tok fail]',TokenType[data as TokenType],'| now:',now&&now.value)
            throw new Error(`无法找到${TokenType[data as TokenType]}在${now_line(stream)}`)
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
    //箭头属性:作为回调传给各生成器时 this 不会丢失
    private generate=(data:ast_data):PeepholeTree=>{
        let node=this.call(data.type)(data,this.generate)
        //统一把 cst 的行信息下发给生成的 AST 节点(check/censor 依赖 ast.line;
        //直接透传子节点的生成器已有 line,不覆盖)
        if(node instanceof ASTTree&&(node.line==null||node.line.length==0))
            node.line=data.line
        return node
    }
    _run(code:token[]){
        let entry='entry'
        //未显式注册 entry 时回退到 File 规则(或首个规则),保持 cst 节点 type=File 供 ast 分发
        let rule=this.parse.find(r=>r.name==entry)||this.parse.find(r=>r.name=='File')||this.parse[0]
        if(!rule)
            throw new Error('入口规则不存在')
        let stream=new ParserStream(code)
        let cst=parse(stream,rule,
            new Map(this.parse.map(r=>[r.name,r])))
        if(typeof cst=='string')throw new Error('解析出的头为字符串而非AST对象,请检查您的编译器插件')
        //loop 规则(如 File 的 file/links)遇到失败会静默停止,若不检查残留 token,
        //语法错误会被吞掉并产出"空/截断"程序(旧行为:map 少逗号→File 空且 check 0 error)
        if(stream.now()!=null)
            throw new Error(`未解析的 token:${stream.now().value}在${now_line(stream)}`)
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