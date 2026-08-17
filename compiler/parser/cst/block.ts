import {Parser as $, TokenType} from '../../utils'
const ModuleName=$.w('ModuleName',TokenType.Identifier,'.')
const link=$.s('link',$.d('link'),$.r('ModuleName'),$.d('as'),TokenType.Identifier,$.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
//Module 缺 {} 包裹,内部 blocks 永远匹配零个(原实现 module 块是空壳)
const _module=$.s('Module',$.d('module'),$.t('{',$.r('blocks'),'}'))
const _class=$.s('Class',$.d('class'),$.c($.d('implements'),$.r('ModuleName')),
    $.t('{',$.r('blocks'),'}'))
const _interface=$.s('Interface',$.d('interface'),$.c($.d('implements'),$.r('ModuleName')),
    $.t('{',$.r('blocks'),'}'))
const _enum=$.s('Enum',$.d('enum'),$.d('{'),$.w('EnumList',TokenType.Identifier,','),'}')
const _function=$.s('Function',
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
    file
]