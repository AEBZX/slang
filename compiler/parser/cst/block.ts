import {Parser as $, TokenType,operations} from '../../utils'
const GenericList=$.s('GenericList',$.d('<'),
    $.w('GenericData',$.s('Generic',TokenType.Identifier,$.c($.d('implements'),$.r('Type'))),',')
    ,$.d('>'))
const ModuleName=$.s('ModuleName',$.r('Type'))
//implements 目标:接口类型。用 BasicType(类名+可选泛型)而非 Type——Type 会把紧随的空类体 {} 当 MapFix 后缀吃掉
const ImplementsName=$.s('ImplementsName',$.r('BasicType'))
const link=$.s('link',$.d('link'),$.r('ModuleName'),$.d('as'),TokenType.Identifier,$.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
const _module=$.s('Module',$.d('module'),$.t('{',$.r('blocks'),'}'))
const _class=$.s('Class',$.d('class'),$.c($.r('GenericList'))
    ,$.c($.d('implements'),$.r('ImplementsName')),
    $.t('{',$.r('blocks'),'}'))
const _interface=$.s('Interface',$.d('interface'),$.c($.r('GenericList'))
    ,$.c($.d('implements'),$.r('ImplementsName')),
    $.t('{',$.r('blocks'),'}'))
const _enum=$.s('Enum',$.d('enum'),$.d('{'),$.w('EnumList',TokenType.Identifier,','),'}')
const _function=$.s('Function',$.c($.r('GenericList')),
    $.r('Type'),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    $.r('Commands'))
const _operation=$.s('Operation',$.d('operation'),
    //符号:组合型([]/[]=/()/p*/p&/p++/++p 等)须按 token 序列匹配;单字符直接匹配
    $.o('symbol',
        '+','-','*','/','%','&','|','&&','||','^','>>','<<','!','>','<','>=','<=','!=','==','=','~',':',
        $.s('BSET',$.d('['),$.d(']'),$.d('=')),
        $.s('BIDX',$.d('['),$.d(']')),
        $.s('CALL',$.d('('),$.d(')')),
        $.s('STAR',$.d('p'),$.d('*')),
        $.s('AMPR',$.d('p'),$.d('&')),
        $.s('PPRE',$.d('+'),$.d('+'),$.d('p')),
        $.s('MPRE',$.d('-'),$.d('-'),$.d('p')),
        $.s('PPOST',$.d('p'),$.d('+'),$.d('+')),
        $.s('MPOST',$.d('p'),$.d('-'),$.d('-'))
    ),$.r('LambdaExpression'))
const _cast=$.s('Cast',$.d('cast'),$.r('Type'),$.r('LambdaExpression'))
const _var=$.s('Variable',$.d('var'),':',$.r('Type'),$.c($.d('='),$.r('Expression')),';')
const block=$.s('Block',$.r('Modifiers'),TokenType.Identifier,':',
    $.o('BlockData',$.r('Module'),$.r('Class'),$.r('Interface')
        ,$.r('Enum'),$.r('Function'),$.r('Variable')))
const blocks=$.l('blocks',$.r('Block'))
const value=$.s('Value',$.d('value'),$.r('BasicType'),$.t('{',$.l('vblocks',$.o('ValueData',$.r('Operation'),$.r('Cast'))),'}'))
const file=$.s('File',$.l('Links',$.r('link')),$.l('file',$.o('FileData',
    $.r('Block'),$.r('Value'))))
export default [
    ModuleName,
    ImplementsName,
    link,
    Modifier,
    _module,
    _class,
    _interface,
    _enum,
    _function,
    _var,
    block,
    _operation,
    _cast,
    blocks,
    value,
    file,GenericList
]