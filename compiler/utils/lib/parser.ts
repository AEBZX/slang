import {ast_data, ast_visitor, cst_data, token, TokenType} from '../data'

export class CSTStream{
    index:number
    code:token[]
    error:string[]
    constructor(code:token[]){
        this.index = 0
        this.code = code
        this.read_index=0
        this.error=[]
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
    thr(message:string){
        this.error.push(message)
    }
}
export class CSTRule{
    data:(TokenType|string|CSTRule)[]
    _idx:number
    constructor(public stream:CSTStream,...data:(TokenType|string|CSTRule)[]){
        this.data=data
        this._idx=stream?stream.index:0
    }
    match():boolean{
        return
    }
    generate():cst_data{
        return
    }
}
export function cst_match(stream:CSTStream,data:(TokenType|string|CSTRule)){
    let saved=stream.index
    if(typeof data=='string'){
        if(stream.now()&&stream.now().value==data){
            stream.next()
            return true
        }else stream.thr(`期望为token:${data},实际为${stream.now()?stream.now().value:'<流末尾>'},在行${stream.now()?stream.now().line:'?'}`)
    }else if(data instanceof CSTRule)
        return data.match()
    else if(stream.now()&&stream.now().type==data){
        stream.next()
        return true
    }else stream.thr(`期望为token:${data.toString()},实际为${stream.now()?stream.now().type:'<流末尾>'},在行${stream.now()?stream.now().line:'?'}`)
    stream.index=saved
    return false
}
export class CSTRule_Seg extends CSTRule{
    match():boolean{
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this._idx=this.stream.index
        for(let i of this.data){
            if(typeof i=='string'){
                if(!this.stream.now()||this.stream.now().value!=i)
                    return false
                this.stream.next()
            }else if(i instanceof CSTRule){
                if(!i.match())
                    return false
            }else{
                if(!this.stream.now()||this.stream.now().type!=i)
                    return false
                this.stream.next()
            }
        }
        return true
    }
    generate():cst_data{
        this.stream.index=this._idx
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
        this._idx=this.stream.index
        for(let i of this.data){
            this.stream.index=this._idx
            if(typeof i=='string'){
                if(this.stream.now()&&this.stream.now().value==i){
                    this._d=i
                    this.stream.next()
                    return true
                }
            }else if(i instanceof CSTRule){
                if(i.match()){
                    this._d=i
                    return true
                }
            }else{
                if(this.stream.now()&&this.stream.now().type==i){
                    this._d=i
                    this.stream.next()
                    return true
                }
            }
        }
        return false
    }
    generate():cst_data{
        this.stream.index=this._idx
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
export class CSTRule_Loop extends CSTRule_Seg{
    len:number
    _startIndex:number
    match():boolean{
        this.len=0
        for(let i of this.data)
            if(i instanceof CSTRule)i.stream=this.stream
        this._startIndex=this.stream.index
        this._idx=this.stream.index
        while(true){
            let saved=this.stream.index
            if(!super.match()){
                this.stream.index=saved
                break
            }
            this.len++
        }
        this._idx=this._startIndex
        return true
    }
    generate():cst_data{
        this.stream.index=this._idx
        let ret:cst_data[]=[]
        for(let i=0;i<this.len;i++){
            this._idx=this.stream.index
            ret.push(...<cst_data[]>super.generate())
        }
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
        if(this.start instanceof CSTRule)this.start.stream=this.stream
        if(this.body instanceof CSTRule)this.body.stream=this.stream
        if(this.split instanceof CSTRule)this.split.stream=this.stream
        if(this.end instanceof CSTRule)this.end.stream=this.stream
        this._idx=this.stream.index
        let m=(a:TokenType|string|CSTRule)=>{
            if(typeof a=='string'){
                if(!this.stream.now()||this.stream.now().value!=a)
                    return false
                this.stream.next()
            }else if(a instanceof CSTRule){
                if(!a.match())
                    return false
            }else{
                if(!this.stream.now()||this.stream.now().type!=a)
                    return false
                this.stream.next()
            }
            return true
        }
        if(!m(this.start))return false
        this.has=false
        if(m(this.end))return true
        this.has=true
        if(!m(this.body))return false
        if(m(this.end))return true
        while(true){
            if(!m(this.split))return false
            if(!m(this.body))return false
            this.len++
            if(m(this.end))return true
        }
    }
    generate():cst_data{
        let g=(a:TokenType|string|CSTRule)=>{
            if(typeof a=='string'&& this.stream.now()&&this.stream.now().value==a)
                return this.stream.next()
            else if(a instanceof CSTRule){
                a.stream=this.stream
                return a.generate()
            }else
                return this.stream.next()
        }
        this.stream.index=this._idx
        if(!this.has)return new CSTRule_Seg(this.stream,this.start,this.end).generate()
        let ret:cst_data[]=[]
        ret.push(g(this.start))
        ret.push(g(this.body))
        for(let i=0;i<this.len;i++) {
            ret.push(g(this.split))
            ret.push(g(this.body))
        }
        ret.push(g(this.end))
        return ret
    }

}
export class CSTRule_Ref extends CSTRule{
    constructor(public getter:()=>CSTRule){
        super(null)
    }
    match():boolean{
        let rule=this.getter()
        rule.stream=this.stream
        this._idx=this.stream.index
        return rule.match()
    }
    generate():cst_data{
        let rule=this.getter()
        rule.stream=this.stream
        this.stream.index=this._idx
        return rule.generate()
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
    _idx:number
    constructor(public stream:ASTStream,public name:string,...data:(TokenType|string|ASTRule)[]){
        this.data=data
        this._idx=stream?stream.index:0
    }
    match():boolean{
        return
    }
    error(){
    }
    generate():ast_data|token{
        return
    }
}
function line(data: (token | ast_data)[]): string[] {
    let ls=new Set<string>()
    for(let i of data){
        if('children' in i)
            for(let j of i.line)
                ls.add(j)
        else ls.add(i.line)
    }
    return [...ls]
}
function children(data: (token | ast_data)[]){
    let ret=[]
    for(let i of data){
        if('children' in i)
            ret.push(i)
        else ret.push(i.value)
    }
    return ret
}
function ast_match(stream:ASTStream,rule:TokenType|string|ASTRule){
    let now=stream.now()
    if(now==undefined)
        return false
    if(typeof rule=='string'){
        if(Array.isArray(now))
            return false
        if((<token>now).value!=rule)
            return false
    }else if(rule instanceof ASTRule) {
        if (!rule.match())
            return false
    }else{
        if(Array.isArray(now))
            return false
        if((<token>now).type!=rule)
            return false
    }
    return true
}
function ast_generate(stream:ASTStream,rule:TokenType|string|ASTRule){
    if(typeof rule=='string')
        return <token>stream.next()
    else if(rule instanceof ASTRule){
        rule.stream=stream
        return rule.generate()
    }else
        return <token>stream.next()
}
export class ASTRule_Seg extends ASTRule{
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this._idx=this.stream.index
        for(let i of this.data){
            if(!ast_match(this.stream,i))
                return false
            if(!(i instanceof ASTRule))
                this.stream.next()
        }
        return true
    }
    generate():ast_data{
        this.stream.index=this._idx
        let child=[]
        this.data.forEach(i=>{
            let result=ast_generate(this.stream,i)
            child.push(result)
        })
        return {
            type:this.name,
            comment:'',
            children:children(child),
            line:line(child)
        }
    }
}
export class ASTRule_Or extends ASTRule{
    m:TokenType|string|ASTRule
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this._idx=this.stream.index
        for(let i of this.data){
            if(ast_match(this.stream,i)) {
                this.m=i
                if(!(i instanceof ASTRule))
                    this.stream.next()
                return true
            }
        }
        return false
    }
    generate():ast_data|token{
        this.stream.index=this._idx
        return ast_generate(this.stream, this.m)
    }
}
export class ASTRule_Choose extends ASTRule{
    m:TokenType|string|ASTRule
    has:boolean
    match():boolean{
        for(let i of this.data)
            if(i instanceof ASTRule)i.stream=this.stream
        this.has=false
        this._idx=this.stream.index
        for(let i of this.data)
            if(ast_match(this.stream,i)) {
                this.m = i
                this.has=true
                if(!(i instanceof ASTRule))
                    this.stream.next()
                break
            }
        return true
    }
    generate():ast_data|token{
        this.stream.index=this._idx
        if(this.has)return ast_generate(this.stream, this.m)
        return {
            type:this.name,
            comment:'',
            children:[],
            line:[]
        }
    }
}
export class ASTRule_Loop extends ASTRule_Seg{
    len:number
    has:boolean
    _startIndex:number
    match(): boolean {
        for(let i of this.data)
            if(i instanceof ASTRule)
                i.stream=this.stream
        this.len=0
        this._startIndex=this.stream.index
        this._idx=this.stream.index
        while(true){
            if(!super.match())
                break
            this.len++
        }
        this._idx=this._startIndex
        return true
    }
    generate(): ast_data {
        this.stream.index=this._idx
        let child=[]
        for(let i=0;i<this.len;i++){
            this._idx=this.stream.index
            child.push(super.generate())
        }
        return {
            type:this.name,
            comment:'',
            children:children(child),
            line:line(child)
        }
    }
}
export class ASTRule_While extends ASTRule{
    constructor(name:string,public start:TokenType|string|ASTRule,public body:TokenType|string|ASTRule,
                public split:TokenType|string|ASTRule,public end:TokenType|string|ASTRule) {
        super(null,name)
    }
    has:boolean
    len:number
    private _setStream(){
        if(this.start instanceof ASTRule) this.start.stream=this.stream
        if(this.body instanceof ASTRule) this.body.stream=this.stream
        if(this.split instanceof ASTRule) this.split.stream=this.stream
        if(this.end instanceof ASTRule) this.end.stream=this.stream
    }
    match():boolean{
        this.len=0
        this._setStream()
        if(!this.stream)return false
        this._idx=this.stream.index
        let m=(a:TokenType|string|ASTRule)=>{
            if(!ast_match(this.stream,a))
                return false
            if(!(a instanceof ASTRule))
                this.stream.next()
            return true
        }
        if(!m(this.start))return false
        if(ast_match(this.stream,this.end)) {
            if(!(this.end instanceof ASTRule))
                this.stream.next()
            this.has=false
            return true
        }
        while(true){
            if(!m(this.body))
                return false
            this.len++
            if(ast_match(this.stream,this.end)) {
                if(!(this.end instanceof ASTRule))
                    this.stream.next()
                this.has=true
                return true
            }
            if(!m(this.split))
                return false
        }
    }
    generate(): ast_data {
        this.stream.index=this._idx
        let start_result=ast_generate(this.stream,this.start)
        let end_result:ast_data|token
        if(!this.has) {
            end_result=ast_generate(this.stream,this.end)
            return {
                type: this.name,
                comment:'',
                children: [],
                line: line([start_result,end_result])
            }
        }
        let child=[]
        for(let i=0;i<this.len;i++){
            let body_result=ast_generate(this.stream,this.body)
            child.push(body_result)
            if(i<this.len-1)
                ast_generate(this.stream,this.split)
        }
        end_result=ast_generate(this.stream,this.end)
        return {
            type:this.name,
            comment:'',
            children:children( child),
            line:line([start_result,...child,end_result])
        }
    }
}
export class ASTRule_Ref extends ASTRule{
    constructor(public getter:()=>ASTRule){
        super(null,'')
    }
    match():boolean{
        let rule=this.getter()
        rule.stream=this.stream
        this._idx=this.stream.index
        return rule.match()
    }
    generate():ast_data|token{
        let rule=this.getter()
        rule.stream=this.stream
        this.stream.index=this._idx
        return rule.generate()
    }
}
export class ASTVisitor{
    data:Map<string,ast_visitor>
    constructor(public ast:ast_data) {
        this.data=new Map()
    }
    register(name:string,visitor:ast_visitor){
        this.data.set(name,visitor)
    }
    visit(){
        let v=(a:ast_data)=>{
            if(!this.data.has(a.type))return a
            a=this.data.get(a.type)(a)
            for(let i=0;i<a.children.length;i++)
                if(typeof a.children[i]!='string')
                    a.children[i]=v(a.children[i] as ast_data)
            return a
        }
        return v(this.ast)
    }
}
export default {
    cst:{
        s: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Seg(null,...data),
        o: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Or(null,...data),
        c: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Choose(null,...data),
        l: (...data:(TokenType|string|CSTRule)[])=>new CSTRule_Loop(null,...data),
        w: (start:(TokenType|string|CSTRule),body:(TokenType|string|CSTRule),
            split:(TokenType|string|CSTRule),end:(TokenType|string|CSTRule))=>new CSTRule_While(start,body,split,end),
        ref: (getter:()=>CSTRule)=>new CSTRule_Ref(getter)
    },
    ast:{
        s: (name:string,...data:(TokenType|string|ASTRule)[])=>new ASTRule_Seg(null,name,...data),
        o: (...data:(TokenType|string|ASTRule)[])=>new ASTRule_Or(null,null,...data),
        c: (name:string,...data:(TokenType|string|ASTRule)[])=>new ASTRule_Choose(null,name,...data),
        l: (name:string,...data:(TokenType|string|ASTRule)[])=>new ASTRule_Loop(null,name,...data),
        w: (name:string,start:(TokenType|string|ASTRule),body:(TokenType|string|ASTRule),
            split:(TokenType|string|ASTRule),end:(TokenType|string|ASTRule))=>
            new ASTRule_While(name,start,body,split,end),
        ref: (getter:()=>ASTRule)=>new ASTRule_Ref(getter),
        factory:(name:string,visitor:ast_visitor)=>{return {name,visitor}},
        visit:(ast:ast_data,visitors:{name:string,visitor:ast_visitor}[])=>{
            let v=new ASTVisitor(ast)
            for(let i of visitors)
                v.register(i.name,i.visitor)
            return v.visit()
        },
    }
}