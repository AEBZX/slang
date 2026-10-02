import {TokenType} from '../../utils'
import {$} from '../../utils/lib/parser'
const AAssign=$.s('AAssign',$.r('Expression'),$.d('='),$.r('Expression'),$.c(';'))
const AddAssign=$.s('AddAssign',$.r('Expression'),$.d('+='),$.r('Expression'),$.c(';'))
const SubAssign=$.s('SubAssign',$.r('Expression'),$.d('-='),$.r('Expression'),$.c(';'))
const MulAssign=$.s('MulAssign',$.r('Expression'),$.d('*='),$.r('Expression'),$.c(';'))
const DivAssign=$.s('DivAssign',$.r('Expression'),$.d('/='),$.r('Expression'),$.c(';'))
const ModAssign=$.s('ModAssign',$.r('Expression'),$.d('%='),$.r('Expression'),$.c(';'))
const AndAssign=$.s('AndAssign',$.r('Expression'),$.d('&='),$.r('Expression'),$.c(';'))
const OrAssign=$.s('OrAssign',$.r('Expression'),$.d('|='),$.r('Expression'),$.c(';'))
const XorAssign=$.s('XorAssign',$.r('Expression'),$.d('^='),$.r('Expression'),$.c(';'))
const ShlAssign=$.s('ShlAssign',$.r('Expression'),$.d('<<='),$.r('Expression'),$.c(';'))
const ShrAssign=$.s('ShrAssign',$.r('Expression'),$.d('>>='),$.r('Expression'),$.c(';'))
const Assign=$.o('Assign',
    $.r('AAssign'),
    $.r('AddAssign'),
    $.r('SubAssign'),
    $.r('MulAssign'),
    $.r('DivAssign'),
    $.r('ModAssign'),
    $.r('AndAssign'),
    $.r('OrAssign'),
    $.r('XorAssign'),
    $.r('ShlAssign'),
    $.r('ShrAssign'),
)
const VarDecl=$.s('VarDecl',$.d('var'),$.r('Identifier'),$.d(':'),$.r('Type')
    ,$.c($.d('='),$.r('Expression')),$.d(';'))
const ExprCommand=$.s('ExprCommand',$.r('Expression'),$.d(';'))
const Await=$.s('Await',$.d('await'),$.r('Commands'))
const Return=$.s('Return',$.d('return'),$.c($.r('Expression')),$.d(';'))
const Break=$.s('Break',$.d('break'),$.d(';'))
const Continue=$.s('Continue',$.d('continue'),$.d(';'))
const Throw=$.s('Throw',$.d('throw'),$.r('Expression'),$.d(';'))
const VM=$.s('VM',$.d('vm')
    ,$.d('('),TokenType.String,$.w('VMParam',$.r('Expression'),','),$.d(')'),$.d(';'))
const BasicCommand=$.o('BasicCommand',
    $.r('VarDecl'),
    $.r('ExprCommand'),
    $.r('Await'),
    $.r('Return'),
    $.r('Break'),
    $.r('Continue'),
    $.r('Throw'),
    $.r('VM'),
    $.r('Assign')
    )
const Condition=$.s('Condition',$.t('(',$.r('Expression'),')'))
const IfStatement=$.s('IfStatement',$.d('if'),$.r('Condition'),$.r('Commands'),
    $.c($.d('else'),$.r('Commands')))
const WhileStatement=$.s('WhileStatement',$.d('while'),$.r('Condition'),$.r('Commands'))
const DoWhileStatement=$.s('DoWhileStatement',$.d('do'),$.r('Commands'),$.d('while'),$.r('Condition'),$.d(';'))
const ForStatement=$.s('ForStatement',$.d('for'),$.d('('),
    $.l('Init',$.r('VarDecl')),$.r('Expression'),$.d(';'),$.l('Step',$.r('BasicCommand')),
    $.d(')'),$.r('Commands'))
const ForeachStatement=$.s('ForeachStatement',$.d('foreach'),$.d('('),
    $.r('Identifier'),$.d(':'),$.r('Expression'),$.d(')'),$.r('Commands')
)
const SwitchStatement=$.s('SwitchStatement',$.d('switch'),$.r('Condition'),$.d('{'),
    $.l('CaseList',$.s('Case',
        $.d('case'),$.r('Expression'),$.d('=>'),$.r('Commands')
    )),
    $.c($.d('default'),$.d('=>'),$.r('Commands')),
    $.d('}')
)
const TryStatement=$.s('TryStatement',$.d('try'),$.r('Commands'),
    $.d('catch'),$.d('('),TokenType.Identifier,$.d(':'),$.r('Type'),$.d(')'),$.r('Commands'),
    $.c($.d('finally'),$.r('Commands')))
const BlockCommand=$.o('BlockCommand',
    $.r('IfStatement'),
    $.r('WhileStatement'),
    $.r('DoWhileStatement'),
    $.r('ForStatement'),
    $.r('SwitchStatement'),
    $.r('TryStatement'),
    $.r('ForeachStatement'),
    $.t('{',$.l('Commands',$.r('Commands')),'}')
)
const Commands=$.o('Commands',$.r('BlockCommand'),$.r('BasicCommand'))
export default [
    AAssign,
    AddAssign,
    SubAssign,
    MulAssign,
    DivAssign,
    ModAssign,
    AndAssign,
    OrAssign,
    XorAssign,
    ShlAssign,
    ShrAssign,
    Assign,
    VarDecl,
    Await,
    ExprCommand,
    Return,
    Break,
    Continue,
    Throw,
    VM,
    BasicCommand,
    ForeachStatement,
    IfStatement,
    WhileStatement,
    DoWhileStatement,
    ForStatement,
    SwitchStatement,
    TryStatement,
    BlockCommand,
    Commands,
    Condition
]