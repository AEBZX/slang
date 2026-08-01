import {Parser as $, TokenType} from '../../utils/index'
const ModuleName=$.w('ModuleName',TokenType.Identifier,'.')
const link=$.s('link',$.d('link'),$.r('ModuleName'),$.d('as'),TokenType.Identifier,$.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
const _module=$.s('Module',$.d('module'),$.r('blocks'))
const _class=$.s('Class',$.d('class'),$.c($.d('implements'),$.r('ModuleName')),
    $.r('blocks'))
const _interface=$.s('Interface',$.d('interface'),$.c($.d('extends'),$.r('ModuleName')),
    $.r('blocks'))
const _enum=$.s('Enum',$.d('enum'),$.d('{'),$.w('EnumList',TokenType.Identifier,','),'}')
const _function=$.s('Function',$.d('function'),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    '=>',$.r('Type'),$.r('Commands'))
const _var=$.s('Variable',$.d('var'),':',$.r('Type'),$.c($.d('='),$.r('Expression')),';')
const block=$.s('Block',$.r('Modifiers'),TokenType.Identifier,':',
    $.o('BlockData',$.r('Module'),$.r('Class'),$.r('Interface')
        ,$.r('Enum'),$.r('Function'),$.r('Variable')))
const blocks=$.l('blocks',$.r('block'))
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