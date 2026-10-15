import {PeepholeTree} from './lib/tool'

export enum TokenType {
    Identifier,
    Number,
    String,
    Keyword,
    Comment
}
export enum TokenParam{
    Number,String,Identifier
}
export type token={type:TokenType,value:string,line:string}
export type pre_token=[boolean,string,TokenType]
export type ast_data={
    type:string,
    line:string[],
    children:Map<number,ast_data|string>
}
import type {Type} from './model/ast'
export class ASTTree extends PeepholeTree{
    type:Type
    line:string[]
}
export class KeyMap<K,V> extends Map<K,V>{
    dup:K[]=[]
    set(key:K,value:V):this{
        if(this.has(key))this.dup.push(key)
        return super.set(key,value)
    }
}
export class HIRTree extends PeepholeTree{}
export type ast_generate=(data:ast_data,tree:(data:ast_data)=>PeepholeTree)=>PeepholeTree
export type slang_ast_generate=(data:ast_data,tree:(data:ast_data)=>ASTTree)=>ASTTree
export type ast_rule={
    type:string,
    name:string,
    data:ast_rule_param[]
}
export type ast_rule_param=ast_rule|string|TokenType
export let radix_map={
    'x':['1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','A','B','C','D','E','F'],
    'X':['1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','A','B','C','D','E','F'],
    'b':['0','1'],
    'B':['0','1'],
    'o':['0','1','2','3','4','5','6','7'],
    'O':['0','1','2','3','4','5','6','7']
}
export let identifier_start_white_list=['_','$','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
export let identifier_continue_white_list=['_','$','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9']
export let string_start_end=['"','\'','`']
export let number_radix=['x','X','b','B','o','O']
export let keywords=[
    //修饰符
    'public','private','async','sync','static','unstatic',
    '=>',
    //运算符
    '+=','-=', '*=', '/=', '%=', '<<=', '>>=', '&&=', '||=','&=','|=','^=',
    '++','--','===','!==','+=','-=','*=','/=','%=','<<=','>>=','&&=','||=','&=','|=','^=',
    '<<','>>','&&','||','==','!=','>=','<=','+','-','*','/','%','&','|','^','>','<','!','=',
    //new 也必须是关键字:否则它会被词法成标识符,前缀表达式里会先被当成变量名吃掉
    'new',
    //外层关键字
    'link','module','class','enum','interface','of','implements','function','var','as','operation','cast','value',
    //类型关键字
    'void','boolean','number','string','[',']','{','}',
    //命令关键字
    'vm','break','continue','return','throw','await','try','catch','finally','foreach',
    //选择块关键字
    'if','else','switch','case','default','for','while','do',
    //其他
    'null','true','false','(',')','{','}',',','.',':',';','?','~','@'
]
export let operations=[
    '+','-','*','/','%','&','|','&&','||','^','>>','<<','!','>','<','>=','<=','!=','==','=','~',':','new','++','--',
    '[]','()','+=','-=','*=','/=','%=','<<=','>>=','&&=','||=','&=','|=','^='
]
export let tokens=[TokenParam.Number,TokenParam.String,...keywords,TokenParam.Identifier]