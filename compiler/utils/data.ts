export enum TokenType {
    Identifier,
    Number,
    String,
    Keyword
}
export enum TokenParam{
    Number,String,Identifier
}
export type token={type:TokenType,value:string,line:string}
export let radix_map={
    'x':['1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','A','B','C','D','E','F'],
    'X':['1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','A','B','C','D','E','F'],
    'b':['0','1'],
    'B':['0','1'],
    'o':['0','1','2','3','4','5','6','7'],
    'O':['0','1','2','3','4','5','6','7']
}
export let identifier_start_white_list=['_','$','a','b','c','d','e','f','g','h','i','j','k','l','m','n','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z']
export let identifier_continue_white_list=['_','$','a','b','c','d','e','f','g','h','i','j','k','l','m','n','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9']
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