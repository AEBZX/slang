import {ast_data, cst_data, token, TokenType} from '../data'

export class CSTStream{
    index:number
    code:token[]
    constructor(code:token[]){
        this.index = 0
        this.code = code
        this.read_index=0
    }
    read_index:number
    read_mode(){
        this.read_index=this.index
    }
    write_mode(){
        this.index=this.read_index
    }
    next():token{
        return this.code[this.index++]
    }
    now():token{
        return this.code[this.index]
    }
    peek():token{
        return this.code[this.index+1]
    }
}
export class CSTRule{
    data:(TokenType|string|CSTRule)[]
    constructor(public stream:CSTStream,...data:(TokenType|string|CSTRule)[]){
        this.data=data
    }
    match():boolean{
        return
    }
    generate():cst_data{
        return
    }
}
export class CSTRule_Seg extends CSTRule{
    match():boolean{
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this.stream.read_mode()
        for(let i of this.data){
            if(typeof i=='string'&& this.stream.now().value!=i)
                return false
            else if(i instanceof CSTRule&& !i.match())
                return false
            else if(this.stream.now().type!=i)
                return false
        }
    }
    generate():cst_data{
        this.stream.write_mode()
        let ret:cst_data[]=[]
        for(let i of this.data){
            if(i instanceof CSTRule)
                ret.push(i.generate())
            else
                ret.push(this.stream.next())
        }
        return ret
    }
}
export class CSTRule_Or extends CSTRule{
    _d:TokenType|string|CSTRule
    match():boolean{
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this.stream.read_mode()
        for(let i of this.data){
            this._d=i
            if(typeof i=='string'&& this.stream.now().value==i)
                return true
            else if(i instanceof CSTRule&& i.match())
                return true
            else if(this.stream.now().type==i)
                return true
        }
        return false
    }
    generate():cst_data{
        this.stream.write_mode()
        return this._d instanceof CSTRule?this._d.generate():this.stream.next()
    }
}
export class CSTRule_Choose extends CSTRule_Seg{
    has:boolean
    match():boolean{
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this.has=super.match()
        return true
    }
    generate(): cst_data {
        return this.has?super.generate():[]
    }
}
export class CSTRule_Loop extends CSTRule{
    len:number
    match():boolean{
        this.len=0
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this.stream.read_mode()
        while(true){
            this.len++
            if(!super.match())
                return true
        }
    }
    generate():cst_data{
        this.stream.write_mode()
        let ret:cst_data[]=[]
        for(let i=0;i<this.len;i++)
            ret.push(super.generate())
        return ret
    }
}
export class CSTRule_While extends CSTRule{
    has:boolean
    len:number
    constructor(public start:(TokenType|string|CSTRule),public body:(TokenType|string|CSTRule),
                public split:(TokenType|string|CSTRule),public end:(TokenType|string|CSTRule)) {
        super(null)
    }
    match():boolean{
        this.len=0
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this.stream.read_mode()
        let m=(a:TokenType|string|CSTRule)=>{
            if(typeof a=='string'&& this.stream.now().value!=a)
                return false
            else if(a instanceof CSTRule&& !a.match())
                return false
            else if(this.stream.now().type!=a)
                return false
            return true
        }
        if(!m(this.start))return false
        this.has=false
        if(m(this.end))return true
        this.has=true
        if(!m(this.body))return false
        while(true){
            if(!m(this.split))return false
            if(!m(this.body))return false
            this.len++
            if(m(this.end))return true
        }
    }
    generate():cst_data{
        let g=(a:TokenType|string|CSTRule)=>{
            if(typeof a=='string'&& this.stream.now().value==a)
                return this.stream.next()
            else if(a instanceof CSTRule)
                return a.generate()
            else
                return this.stream.next()
        }
        this.stream.write_mode()
        let ret:cst_data[]=[]
        if(!this.has)return new CSTRule_Seg(this.stream,this.start,this.end).generate()
        let start=g(this.start)
        ret.push(g(this.body))
        for(let i=0;i<this.len;i++) {
            g(this.split)
            ret.push(g(this.body))
        }
        return [start,ret,g(this.end)]
    }

}
export class ASTStream{
    index:number
    code:cst_data[]
    constructor(code:cst_data[]){
        this.index = 0
        this.code = code
    }
    read_index:number
    read_mode(){
        this.read_index=this.index
    }
    write_mode(){
        this.index=this.read_index
    }
    next():cst_data{
        return this.code[this.index++]
    }
    now():cst_data{
        return this.code[this.index]
    }
    peek():cst_data{
        return this.code[this.index+1]
    }
}
export class ASTRule{
    data:(TokenType|string|ASTRule)[]
    constructor(public stream:ASTStream,public name:string,...data:(TokenType|string|ASTRule)[]){
        this.data=data
    }
    match():boolean{
        return
    }
    generate():ast_data{
        return
    }
}
function ast_match(rule:TokenType|string|ASTRule){
    if(typeof rule=='string'){
        if(Array.isArray(this.stream.now()))
            return false
        if((<token>this.stream.now()).value!=rule)
            return false
    }else if(rule instanceof ASTRule) {
        if (!rule.match())
            return false
    }else{
        if(Array.isArray(this.stream.now()))
            return false
        if((<token>this.stream.now()).type!=rule)
            return false
    }
    return true
}
function ast_generate(rule:TokenType|string|ASTRule){
    if(typeof rule=='string')
        return this.stream.next()
    else if(rule instanceof ASTRule)
        return rule.generate()
    else
        return this.stream.next()
}
export class ASTRule_Seg extends ASTRule{
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this.stream.read_mode()
        for(let i of this.data){
            if(!ast_match(i))
                return false
        }
        return true
    }
    generate():ast_data{
        this.stream.write_mode()
        return {
            type:this.name,
            children:this.data.map(i=>{
                return ast_generate(i)
            })
        }
    }
}
export class ASTRule_Or extends ASTRule{
    m:TokenType|string|ASTRule
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this.stream.read_mode()
        for(let i of this.data){
            if(ast_match(i)) {
                this.m=i
                return true
            }
        }
        return false
    }
    generate():ast_data{
        this.stream.write_mode()
        return ast_generate(this.m)
    }
}
export class ASTRule_Choose extends ASTRule{
    m:TokenType|string|ASTRule
    has:boolean
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this.has=false
        this.stream.read_mode()
        for(let i of this.data)
            if(ast_match(i)) {
                this.m = i
                this.has=true
            }
        return true
    }
    generate():ast_data{
        this.stream.write_mode()
        if(this.has)return ast_generate(this.m)
        return {
            type:this.name,
            children:[]
        }
    }
}
export default {
    cst:{
        s: (...data:(TokenType|string|CSTRule)[])=>new CSTRule(null,...data),
        o: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Or(null,...data),
        c: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Choose(null,...data),
        l: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Loop(null,...data),
        w: (start:(TokenType|string|CSTRule),body:(TokenType|string|CSTRule),
            split:(TokenType|string|CSTRule),end:(TokenType|string|CSTRule))=>new CSTRule_While(start,body,split,end)
    }
}