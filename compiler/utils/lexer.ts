import {
    identifier_continue_white_list,
    identifier_start_white_list, number_radix, radix_map, string_start_end, token, TokenParam
} from './data'

export class Lexer{
}
class CharStream{
    public index:number
    public code:string[]
    constructor(code:string){
        this.index = 0
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
let number_match:(stream:CharStream)=>[boolean,string]= (stream:CharStream)=>{
    //考虑+-
    if(stream.now()=='+'||stream.now()=='-'){
        let sign=stream.next()
        let ret=number_match(stream)
        return [ret[0],sign+ret[1]]
    }
    if(stream.now()=='0'){
        stream.next()
        if(number_radix.includes(stream.now())){
            let radix=stream.next()
            let ret=''
            //本来就是0
            if(!(radix_map[radix].includes(stream.now()))){
                stream.index--
                return [true,'0']
            }
            while(radix_map[radix].includes(stream.now())){
                ret+=stream.next()
            }
            return [true,ret]
        }else
            return [true,'0']
    }
    let ret=''
    while(stream.now()>='0'&&stream.now()<='9'){
        ret+=stream.next()
    }
    return [ret != '',ret]
}
let string_match:(stream:CharStream)=>[boolean,string]= (stream:CharStream)=>{
    let start=stream.now()
    if(!string_start_end.includes(start))
        return [false,'']
    let ret=stream.next()
    while(true){
        ret+=stream.next()
        if(stream.now()==start){
            if(ret[ret.length-1]!='\\')
                continue
            ret+=stream.next()
            break
        }
    }
    return [true,ret]
}
let identifier_match:(stream:CharStream)=>[boolean,string]= (stream:CharStream)=>{
    let ret=''
    if(!identifier_start_white_list.includes(stream.now()))
        return [false,'']
    ret+=stream.next()
    while(identifier_continue_white_list.includes(stream.now())){
        ret+=stream.next()
    }
    return [ret != '',ret]
}
let comment_match:(stream:CharStream)=>[boolean,string]= (stream:CharStream)=>{
    if(stream.now()=='/'){
        let ret=stream.next()
        if(stream.now()=='/'){
            ret+=stream.next()
            while(stream.now()!='\n'){
                ret+=stream.next()
            }
            return [true,ret]
        }
        if(stream.now()=='*'){
            while(stream.now()!='*'||stream.peek()!='/'){
                ret+=stream.next()
            }
            ret+=stream.next()
            ret+=stream.next()
        }
    }
}
function match(input:TokenParam|string):(stream:CharStream)=>[boolean,string]{
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
                    return [false, '']
                }
            }
            return [true,input]
        }
    }
}
export function lexer(code:string):token[]{
    let ret=[]
    return ret
}