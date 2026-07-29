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
function seg_rule(name:string,...data:ast_rule_param[]){
    return {
        type:'seg',
        name,data
    }
}
//仅占位
function delete_rule(name:string,...data:ast_rule_param[]){
    return {
        type:'delete',
        name,data
    }
}
//返回第一个不是delete_rule的
function child_rule(name:string,...data:ast_rule_param[]){
    return {
        type:'child',
        name,data
    }
}
function or_rule(name:string,...data:ast_rule_param[]){
    return {
        type:'or',
        name,data
    }
}
function choose_rule(name:string,...data:ast_rule_param[]){
    return {
        type:'choose',
        name,data
    }
}
function call_rule(name:string){
    return {
        type:'call',
        name,
        data:null
    }
}
function while_rule(name:string,data:ast_rule_param,split:ast_rule_param){
    return {
        type:'while',
        name,
        data:[data,split]
    }
}
function loop_rule(name:string,data:ast_rule_param){
    return {
        type:'loop',
        name,
        data:[data]
    }
}
function parse(stream:ParserStream,data:ast_rule_param,ref:Map<string,ast_rule>):ast_data{
    switch (typeof data){
        case 'string':{
            if(this.stream.now().value==data){
                this.stream.next()
                return this.stream.now().value
            }
            throw new Error(`无法找到${data}在${stream.now().line}`)
        }
        case 'object':{
            let ret:ast_data={
                type:data.name,
                comment:null,
                children:new Map(),
                line:[]
            }
            let line=new Set<string>()
            let ls:ast_data,token_num=0
            switch (data.type){
                case 'seg':{
                    for(let i of data.data){
                        ls=parse(this.stream,i,ref)
                        if(ls!=null){
                            if(typeof ls=='string'){
                                ret.children.set(`token_${token_num}`,ls)
                                line.add(stream.code[stream.pos-1].line)
                                token_num++
                            }
                            if(typeof ls=='object'){
                                ret.children.set(ls.type,ls)
                                for(let j of ret.line)line.add(j)
                            }
                        }
                    }
                    ret.line=[...line]
                    break
                }
                case 'delete':{
                    data.type='seg'
                    parse(stream,data,ref)
                    ret=null
                    break
                }
                case 'child':{
                    data.type='seg'
                    ls=parse(stream,data,ref)
                    for(let [name,i] of ls.children){
                        if(i!=null&&typeof i=='object')
                            ret=i
                    }
                    break
                }
                case 'or':{
                    let ok=false
                    for(let i of data.data){
                        try{
                            ls=parse(stream,i,ref)
                            if(ls!=null){
                                ok=true
                                ret=ls
                                break
                            }
                        }catch (e) {
                        }
                    }
                    let a=[]
                    for(let i of data.data)a.push(typeof i=='string'?i:typeof i=='object'?i.name:TokenType[i])
                    if(!ok)throw new Error(`无法找到${a.join(' ')}中的任意一条规则在${stream.now().line}`)
                    break
                }
                case 'choose':{
                    try{
                        ls=parse(stream,data.data[0],ref)
                    }catch (e) {
                        ls=null
                    }
                    break
                }
                case 'call':{
                    ls=parse(stream,ref.get(data.name),ref)
                    break
                }
                case 'while':{
                    let param_num=0
                    ret.children.set(`param_${param_num}`,parse(stream,data.data[0],ref))
                    while(true){
                        try{
                            ls=parse(stream,data.data[1],ref)
                        }catch (e) {
                            break
                        }
                        param_num++
                        ret.children.set(`param_${param_num}`,ls)
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
            if(this.stream.now().type==data){
                this.stream.next()
                return this.stream.now().value
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
    parse(name:string):ast_data{
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