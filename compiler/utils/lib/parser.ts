import {ast_data, ast_rule, ast_rule_param, token, TokenType} from '../data'

class ParserStream{
    public pos:number
    public code:token[]
    constructor(code:token[]) {
        this.pos = 0
        this.code = code
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
function parse(stream:ParserStream,data:ast_rule_param,ref:Map<string,ast_rule>):ast_data|string{
    switch (typeof data){
        case 'string':{
            if(stream.now().value==data){
                let ret=stream.now().value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${data}在${stream.now().line}`)
        }
        case 'object':{
            let ret:ast_data|string={
                type:data.name,
                comment:null,
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
                    let saved_type=data.type
                    data.type='seg'
                    parse(stream,data,ref)
                    data.type=saved_type
                    ret=null
                    break
                }
                case 'child':{
                    let saved_type=data.type
                    data.type='seg'
                    ls=parse(stream,data,ref)
                    data.type=saved_type
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
                    if(!ok)throw new Error(`无法找到${a.join(' ')}中的任意一条规则在${stream.now().line}`)
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
                    try{
                        ret.children.set(`param_${param_num}`,parse(stream,data.data[0],ref))
                        param_num++
                    }catch (e) {}
                    while(true){
                        try{
                            ls=parse(stream,data.data[1],ref)
                            ret.children.set(`param_${param_num}`,parse(stream,data.data[0],ref))
                            param_num++
                        }catch (e) {
                            break
                        }
                    }
                    break
                }
                case 'loop':{
                    let param_num=0
                    while(true){
                        try{
                            ret.children.set(`param_${param_num}`,parse(stream,data.data[0],ref))
                        }catch (e){
                            break
                        }
                        param_num++
                    }
                    break
                }
            }
            return ret
        }
        default:{
            if(stream.now().type==data){
                let ret=stream.now().value
                stream.next()
                return ret
            }
            throw new Error(`无法找到${TokenType[data as TokenType]}在${stream.now().line}`)
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
        return data.parse(entry)
    }
}