import {Parser as $, TokenType} from '../utils'
const ModuleName=$.w('ModuleName',TokenType.Identifier,'.')
const link=$.s('link',$.r('ModuleName'),$.d('as'),TokenType.Identifier,$.d(';'))
const Modifier=$.l('Modifiers',$.o('Modifier',
    'public','private','unstatic','static','async','sync'
))
const _module=$.s('Module',$.d('module'),$.r('Blocks'))
const _class=$.s('Class',$.d('class'),$.c($.d('implements'),$.r('ModuleName')),
    $.r('Blocks'))
const _interface=$.s('Interface',$.d('interface'),$.c($.d('extends'),$.r('ModuleName')),
    $.r('Blocks'))
const _enum=$.s('Enum',$.d('enum'),$.d('{'),$.w('EnumList',TokenType.Identifier,','),'}')
const _function=$.s('Function',$.d('function'),
    $.t('(',$.w('ParamIdentifier',$.s('ParamData',TokenType.Identifier,':',$.r('Type')),','),')'),
    '=>',$.r('Type'),$.r('Commands'))
const _var=$.s('Variable',$.d('var'),$.r('Type'),$.c($.d('='),$.r('Expression')),';')
const block=$.s('Block',$.r('Modifiers'),TokenType.Identifier,':',
    $.o('BlockData',$.r('_module'),$.r('_class'),$.r('_interface')
        ,$.r('_enum'),$.r('_function'),$.r('_var')))
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