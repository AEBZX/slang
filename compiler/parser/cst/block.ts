import {Parser as $, TokenType} from '../../utils'
const GenericList=$.s('GenericList',$.d('<'),
    $.w('GenericData',$.s('Generic',TokenType.Identifier,$.c($.d('implements'),$.r('Type'))),',')
    ,$.d('>'))
const ModuleName=$.s('ModuleName',$.r('Type'))
const link=$.s('link',$.d('link'),$.r('ModuleName'),$.d('as'),TokenType.Identifier,$.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
const _module=$.s('Module',$.d('module'),$.t('{',$.r('blocks'),'}'))
const _class=$.s('Class',$.d('class'),$.c($.r('GenericList'))
    ,$.c($.d('implements'),$.r('ModuleName')),
    $.t('{',$.r('blocks'),'}'))
const _interface=$.s('Interface',$.d('interface'),$.c($.r('GenericList'))
    ,$.c($.d('implements'),$.r('ModuleName')),
    $.t('{',$.r('blocks'),'}'))
const _enum=$.s('Enum',$.d('enum'),$.d('{'),$.w('EnumList',TokenType.Identifier,','),'}')
const _function=$.s('Function',$.c($.r('GenericList')),
    $.r('Type'),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    $.r('Commands'))
const _var=$.s('Variable',$.d('var'),':',$.r('Type'),$.c($.d('='),$.r('Expression')),';')
const block=$.s('Block',$.r('Modifiers'),TokenType.Identifier,':',
    $.o('BlockData',$.r('Module'),$.r('Class'),$.r('Interface')
        ,$.r('Enum'),$.r('Function'),$.r('Variable')))
const blocks=$.l('blocks',$.r('Block'))
const file=$.s('File',$.l('Links',$.r('link')),$.r('blocks'))
export default [
    ModuleName,
    link,
    Modifier,
    _module,
    _class,
    _interface,
    _enum,
    _function,
    _var,
    block,
    blocks,
    file,GenericList
]