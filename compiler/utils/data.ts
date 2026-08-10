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
    children:Map<string,ast_data|string>
}
export type ast_type={
    type:string
    data:string
    child:ast_type[]
}
import type {Type} from './model/ast'
export class ASTTree{
    type:Type
    line:string[]
}
export class HIRTree{}
export type ast_generate=(data:ast_data,tree:ast_generate)=>ASTTree
export type ast_rule={
    type:string,
    name:string,
    data:ast_rule_param[]
}
export type ast_rule_param=ast_rule|string|TokenType
//三地址码形式
export type asm_args =['value'|'reg',number]
export type asm_command=[string,asm_args,asm_args,asm_args]
export type asm_pool=Map<string|number,number>
export type bin=[number,number,number,number]
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
    //特殊关键字
    '=>',
    //运算符
    '+=','-=', '*=', '/=', '%=', '<<=', '>>=', '&&=', '||=','&=','|=','^=',
    '++','--','===','!==','+=','-=','*=','/=','%=','<<=','>>=','&&=','||=','&=','|=','^=',
    '<<','>>','&&','||','==','!=','>=','<=','+','-','*','/','%','&','|','^','>','<','!','=',
    //外层关键字
    'link','module','class','enum','interface','of','implements','function','var','as',
    //类型关键字
    'void','boolean','number','string','[',']','{','}',
    //命令关键字
    'vm','break','continue','return','throw','await','try','catch','finally','foreach',
    //选择块关键字
    'if','else','switch','case','default','for','while','do',
    //其他
    'null','true','false','(',')','{','}',',','.',':',';','?','~'
]
export let tokens=[TokenParam.Number,TokenParam.String,...keywords,TokenParam.Identifier]