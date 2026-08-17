import {ast_data, ast_generate, ast_rule, ast_rule_param, ASTTree, token, TokenType} from '../data'

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
function parse(stream:ParserStream,data:ast_rule_param,ref:Map<string,ast_rule>):ast_data|string{
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
        case 'object':{
            let ret:ast_data|string={
                type:data.name,
                children:new Map(),
                line:[]
            }
            let line=new Set<string>()
            let ls:ast_data|string,child_num=0
            switch (data.type){
                case 'seg':{
                    for(let i of data.data){
                        ls=parse(stream,i,ref)
                        if(ls!=null){
                            if(typeof ls=='string'){
                                ret.children.set(`child_${child_num}`,ls)
                                line.add(stream.code[stream.pos-1].line)
                            }
                            if(typeof ls=='object'){
                                ret.children.set(`child_${child_num}`,ls)
                                for(let j of (ls as ast_data).line)line.add(j)
                            }
                            child_num++
                        }
                    }
                    ret.line=[...line]
                    break
                }
                case 'delete':{
                    //不改写共享规则对象,传副本避免递归解析时的状态污染
                    try{
                        parse(stream,{...data,type:'seg'},ref)
                    }finally{
                        ret=null
                    }
                    break
                }
                case 'child':{
                    //同上,传副本
                    ls=parse(stream,{...data,type:'seg'},ref)
                    for(let [name,i] of (ls as ast_data).children){
                        if(i!=null&&typeof i=='object')
                            ret=i
                    }
                    break
                }
                case 'or':{
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
                    break
                }
                case 'choose':{
                    let saved=stream.pos
                    try{
                        for(let i of data.data)
                            ls=parse(stream,i,ref)
                        if(ls!=null)return ls
                    }catch (e) {}
                    stream.pos=saved
                    return null
                }
                case 'call':{
                    ret=parse(stream,ref.get(data.name),ref)
                    break
                }
                case 'while':{
                    let param_num=0
                    let saved=stream.pos
                    try{
                        let child=parse(stream,data.data[0],ref)
                        ret.children.set(`param_${param_num}`,child)
                        if(typeof child=='string')
                            line.add(stream.code[stream.pos-1].line)
                        if(typeof child=='object')
                            for(let j of (child as ast_data).line)line.add(j)
                        param_num++
                    }catch (e) {
                        stream.pos=saved
                    }
                    //0次匹配视为未命中,交由上层决定是否接受
                    if(param_num==0)return null
                    while(true){
                        saved=stream.pos
                        try{
                            ls=parse(stream,data.data[1],ref)
                            let child=parse(stream,data.data[0],ref)
                            ret.children.set(`param_${param_num}`,child)
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
                    break
                }
                case 'loop':{
                    let param_num=0
                    while(true){
                        let saved=stream.pos
                        try{
                            let child=parse(stream,data.data[0],ref)
                            ret.children.set(`param_${param_num}`,child)
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
                    break
                }
            }
            return ret
        }
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
class Parser{
    parser_rule:Map<string,ast_rule>
    stream:ParserStream
    constructor(code:token[]){
        this.stream=new ParserStream(code)
        this.parser_rule=new Map<string,ast_rule>()
    }
    register(rule:ast_rule){
        this.parser_rule.set(rule.name,rule)
    }
    parse(name:string):ast_data|string{
        return parse(this.stream,this.parser_rule.get(name),this.parser_rule)
    }
}
function generate(entry:ast_data,reg:{[key:string]:ast_generate}){
    let g:ast_generate=(data:ast_data,tree:ast_generate)=>{
        if(data.type in reg){
            let ret=reg[data.type](data,tree)
            if(ret&&typeof ret=='object')
                ret.line=[...data.line]
            return ret
        }
    }
    return g(entry,g)
}
export default {
    s:seg_rule,
    d:delete_rule,
    t:child_rule,
    o:or_rule,
    c:choose_rule,
    r:call_rule,
    w:while_rule,
    l:loop_rule,
    run:(entry:string,rule:ast_rule[],code:token[])=>{
        let data=new Parser(code)
        for(let i of rule)
            data.register(i)
        let ret=data.parse(entry)
        //File 解析完必须到 EOF(仅完整程序入口):blocks 的 loop 会吞掉顶层块解析失败
        //(如函数体语法错误),导致整个函数静默丢失且 check 0 errors,产出空程序;剩余 token 即语法错误
        //片段入口(Expression/Commands 等测试用)允许剩余
        let rest=data.stream.now()
        if(entry=='File'&&rest)
            throw new Error(`语法错误:未解析的 token '${rest.value}' at ${rest.line}`)
        return ret
    },
    generate
}