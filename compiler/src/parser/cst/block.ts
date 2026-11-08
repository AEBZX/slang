import {operations, TokenType} from '../../utils'
import {$} from '../../utils/lib/parser'
const GenericList=$.s('GenericList',
    $.d('<'),
    $.w('GenericData',$.s('Generic',TokenType.Identifier,$.c($.d('implements'),$.r('Type'))),','),
    $.d('>'))
const ModuleName=$.s('ModuleName',$.r('Type'))
const ImplementsName=$.s('ImplementsName',$.r('BasicType'))
const link=$.s('link',
    $.d('link'),
    $.r('ModuleName'),$.d('as'),TokenType.Identifier,
    $.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
const _module=$.s('Module',$.d('module'),$.t('{',$.r('blocks'),'}'))
const _class=$.s('Class',$.d('class'),$.c($.r('GenericList')),
    $.c($.d('implements'),$.r('ImplementsName')),
    $.t('{',$.r('blocks'),'}'))
const _interface=$.s('Interface',
    $.d('interface'),$.c($.r('GenericList')),
    $.c($.d('implements'),$.r('ImplementsName')),
    $.t('{',$.r('blocks'),'}'))
const _enum=$.s('Enum',$.d('enum'),
    $.d('{'),
    $.w('EnumList',TokenType.Identifier,','),
    $.d('}'))
const _function=$.s('Function',$.c($.r('GenericList')),
    $.r('Type'),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    $.o('Implement',$.r('Commands'),';'))
const BIDX=$.s('BIDX',$.d('['),$.d(']'))
const CALL=$.s('CALL',$.d('('),$.d(')'))
const _operation=$.s('Operation',$.d('operation'),
    //[] 与 () 是双 token 运算符,不能直接和单 token 一起按字符串匹配
    $.o('symbol',BIDX,CALL,...operations.filter(i=>i!='[]'&&i!='()')),
    $.r('LambdaExpression'))
const _cast=$.s('Cast',$.d('cast'),$.r('Type'),$.r('LambdaExpression'))
const _var=$.s('Variable',$.r('Type'),$.c($.d('='),$.r('Expression')),';')
const block=$.s('Block',$.r('Modifiers'),TokenType.Identifier,':',
    $.o('BlockData',$.r('Module'),$.r('Class'),$.r('Interface')
        ,$.r('Enum'),$.r('Function'),$.r('Variable')))
const blocks=$.l('blocks',$.r('Block'))
const value=$.s('Value',$.d('value'),$.r('BasicType'),$.t('{',$.l('vblocks',$.o('ValueData',$.r('Operation'),$.r('Cast'))),'}'))
const file=$.s('File',
    $.l('Links',$.r('link')),
    $.l('file',
        $.o('FileData',$.r('Block'),$.r('Value'))
    )
)
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