import {
    identifier_continue_white_list,
    identifier_start_white_list,
    number_radix,
    pre_token,
    radix_map,
    string_start_end,
    token,
    TokenParam, tokens,
    TokenType
} from './data'

export class Lexer{
}
class CharStream{
    public index:number
    public code:string[]
    public line:number
    constructor(code:string){
        this.index = 0
        this.line = 1
        this.code = code.split('')
    }
    public next():string{
        return this.code[this.index++]
    }
    public peek():string{
        return this.code[this.index+1]
    }
    public now():string{
        return this.code[this.index]
    }
}
let number_match:(stream:CharStream)=>pre_token= (stream:CharStream)=>{
    //考虑+-
    if(stream.now()=='+'||stream.now()=='-'){
        let sign=stream.next()
        let ret=number_match(stream)
        if(ret[0])
            return [true,sign+ret[1],TokenType.Number]
        stream.index--
        return [false,'',TokenType.Number]
    }
    if(stream.now()=='0'){
        stream.next()
        if(number_radix.includes(stream.now())){
            let radix=stream.next()
            let ret=''
            //本来就是0
            if(!(radix_map[radix].includes(stream.now()))){
                stream.index--
                return [true,'0',TokenType.Number]
            }
            while(radix_map[radix].includes(stream.now())){
                ret+=stream.next()
            }
            return [true,ret,TokenType.Number]
        }else
            return [true,'0',TokenType.Number]
    }
    let ret=''
    while(stream.now()>='0'&&stream.now()<='9'){
        ret+=stream.next()
    }
    return [ret != '',ret,TokenType.Number]
}
let string_match:(stream:CharStream)=>pre_token= (stream:CharStream)=>{
    let start=stream.now()
    if(!string_start_end.includes(start))
        return [false,'',TokenType.String]
    let ret=''
    stream.next()
    while(true){
        if(stream.now()==undefined)
            return [true,ret,TokenType.String]
        if(stream.now()==start){
            if(ret[ret.length-1]=='\\'){
                ret=ret.slice(0,-1)+stream.next()
                continue
            }
            stream.next()
            break
        }
        ret+=stream.next()
    }
    return [true,ret,TokenType.String]
}
let identifier_match:(stream:CharStream)=>pre_token= (stream:CharStream)=>{
    let ret=''
    if(!identifier_start_white_list.includes(stream.now()))
        return [false,'',TokenType.Identifier]
    ret+=stream.next()
    while(identifier_continue_white_list.includes(stream.now()))
        ret+=stream.next()
    return [ret != '',ret,TokenType.Identifier]
}
let comment_match:(stream:CharStream)=>pre_token= (stream:CharStream)=>{
    if(stream.now()=='/'){
        stream.next()
        if(stream.now()=='/'){
            let start=stream.index-1
            while(stream.now()!=undefined && stream.now()!='\n'){
                stream.next()
            }
            let value=stream.code.slice(start,stream.index).join('')
            return [true,value,TokenType.Comment]
        }
        if(stream.now()=='*'){
            let start=stream.index-1
            stream.next()
            while(stream.now()!=undefined && !(stream.now()=='*' && stream.peek()=='/')){
                if(stream.now()=='\n')
                    stream.line++
                stream.next()
            }
            if(stream.now()!=undefined){
                stream.next()
                stream.next()
            }
            let value=stream.code.slice(start,stream.index).join('')
            return [true,value,TokenType.Comment]
        }
    }
    return [false,'',TokenType.Comment]
}
function match(input:TokenParam|string):(stream:CharStream)=>pre_token{
    if(typeof input != 'string'){
        if(input == TokenParam.Number)
            return number_match
        if(input == TokenParam.String)
            return string_match
        if(input == TokenParam.Identifier)
            return identifier_match
    }else{
        return (stream:CharStream)=>{
            let index=stream.index
            for(let i=0;i<input.length;i++){
                if(stream.now()!=input[i]) {
                    stream.index=index
                    return [false, '',TokenType.Keyword]
                }
                stream.next()
            }
            return [true,input,TokenType.Keyword]
        }
    }
}
export function lexer(code:string):token[]{
    let ret:token[]=[]
    code=code.replace('\r\n','\n')
    let stream=new CharStream(code)
    let list:((stream:CharStream)=>pre_token)[]=[]
    tokens.forEach((item)=>{
            list.push(match(item))
        })
    let _match=()=>{
        let result:pre_token=comment_match(stream)
        if(result[0]==true)
            return result
        for(let i of list){
            result=i(stream)
            if(result[0]==true)
                return result
        }
        return [false,'',TokenType.Identifier]
    }
    while(stream.now()!=undefined){
        if(stream.now()=='\n') {
            stream.next()
            stream.line++
            continue
        }
        if(stream.now()==' ') {
            stream.next()
            continue
        }
        let [flag,value,type]=_match()
        if(flag)
            ret.push({type:<TokenType>type,value:<string>value,line:code.split('\n')[stream.line-1]+' at line:'})
        else
            stream.next()
    }
    return ret
}