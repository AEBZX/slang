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
export type cst_data=token|cst_data[]
export type ast_data={
    type:string,
    line:string[],
    comment:string,
    children:(ast_data|string)[]
}
export type ast_visitor=(ast:ast_data)=>ast_data
export type asm_command={
    name:asm_type,
    args:asm_args[]
}
export type asm_args={
    type:'value'|'reg',
    value:number
}
export type asm={
    code:Map<string,asm_command[]>,
    data:Map<number|string,number>,
    pool:Map<number, number|string>
}
export enum asm_type{
    mov,load,add,sub,mul,div,mod,and,or,xor,not,shl,shr,
    cmp,jmp,call,jz,cz,ret,push,pop,in,out
}
export type bin_command={
    name:bin_type,
    args:number[]
}
export type bin={
    pool:Map<number,number|string>,
    bin:bin_command[]
}
export enum bin_type{
    mov_i_i,mov_i_r,mov_r_i,mov_r_r,
    load_i_i,load_i_r,load_r_i,load_r_r,
    add_i_i,add_i_r,add_r_i,add_r_r,
    sub_i_i,sub_i_r,sub_r_i,sub_r_r,
    mul_i_i,mul_i_r,mul_r_i,mul_r_r,
    div_i_i,div_i_r,div_r_i,
    mod_i_i,mod_i_r,mod_r_i,mod_r_r,
    and_i_i,and_i_r,and_r_i,and_r_r,
    or_i_i,or_i_r,or_r_i,or_r_r,
    xor_i_i,xor_i_r,xor_r_i,xor_r_r,
    not_i_i,not_i_r,not_r_i,not_r_r,
    shl_i_i,shl_i_r,shl_r_i,shl_r_r,
    shr_i_i,shr_i_r,shr_r_i,shr_r_r,
    cmp_i_i,cmp_i_r,cmp_r_i,cmp_r_r,
    jmp_i,jmp_r,jz_i,jz_r,cz_i,cz_r,
    call_i,call_r,ret,push_i,push_r,pop_i,pop_r,
    in_i,in_r,out_i,out_r,block_start,block_end
}
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
    //运算符
    '+=','-=', '*=', '/=', '%=', '<<=', '>>=', '&&=', '||=','&=','|=','^=',
    '+','-','*','/','%','<<','>>','&&','||','&','|','^','==','!=','>=','<=','>','<','!','=',
    //外层关键字
    'link','module','class','enum','interface','of','implements','function','var','as',
    //类型关键字
    'void','boolean','number','string','{}','[]','[',']',
    //命令关键字
    'vm','break','continue','return','throw','await',
    //选择块关键字
    'if','else','switch','case','default','for','while','do',
    //其他
    'null','true','false','(',')','{','}',',','.',':',';','?','~'
]
export let tokens=[TokenParam.Identifier,TokenParam.Number,TokenParam.String,...keywords]