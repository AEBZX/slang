import {Parser as $, TokenType} from '../../utils'
//赋值语句的结尾分号可选:for 步进里允许 i=i+1 / i+=1 等不带分号(步进为命令列表)
//注意用 $.c(';') 而非 $.c($.d(';')):choose 仅在子规则返回非 null 时提交位置,
//delete 规则返回 null 会回溯,分号永远不被消费导致后续解析错位
const AAssign=$.s('AAssign',$.r('Expression'),$.d('='),$.r('Expression'),$.c(';'))
const AddAssign=$.s('AddAssign',$.r('Expression'),$.d('+='),$.r('Expression'),$.c(';'))
const SubAssign=$.s('SubAssign',$.r('Expression'),$.d('-='),$.r('Expression'),$.c(';'))
const MulAssign=$.s('MulAssign',$.r('Expression'),$.d('*='),$.r('Expression'),$.c(';'))
const DivAssign=$.s('DivAssign',$.r('Expression'),$.d('/='),$.r('Expression'),$.c(';'))
const ModAssign=$.s('ModAssign',$.r('Expression'),$.d('%='),$.r('Expression'),$.c(';'))
const BitAndAssign=$.s('BitAndAssign',$.r('Expression'),$.d('&='),$.r('Expression'),$.c(';'))
const BitOrAssign=$.s('BitOrAssign',$.r('Expression'),$.d('|='),$.r('Expression'),$.c(';'))
const BitXorAssign=$.s('BitXorAssign',$.r('Expression'),$.d('^='),$.r('Expression'),$.c(';'))
const BitShlAssign=$.s('BitShlAssign',$.r('Expression'),$.d('<<='),$.r('Expression'),$.c(';'))
const BitShrAssign=$.s('BitShrAssign',$.r('Expression'),$.d('>>='),$.r('Expression'),$.c(';'))
const Assign=$.o('Assign',
    $.r('AAssign'),
    $.r('AddAssign'),
    $.r('SubAssign'),
    $.r('MulAssign'),
    $.r('DivAssign'),
    $.r('ModAssign'),
    $.r('BitAndAssign'),
    $.r('BitOrAssign'),
    $.r('BitXorAssign'),
    $.r('BitShlAssign'),
    $.r('BitShrAssign'),
)
const VarDeclaration=$.s('VarDeclaration',$.d('var'),$.r('Identifier'),$.d(':'),$.r('Type')
    ,$.c($.d('='),$.r('Expression')),$.d(';'))
const Call=$.s('Call',$.c('await'),$.r('Expression'),$.d(';'))
const Return=$.s('Return',$.d('return'),$.c($.r('Expression')),$.d(';'))
const Break=$.s('Break',$.d('break'),$.d(';'))
const Continue=$.s('Continue',$.d('continue'),$.d(';'))
const Throw=$.s('Throw',$.d('throw'),$.r('Expression'),$.d(';'))
const VM=$.s('VM',$.d('vm'),TokenType.String,$.d(';'))
const Increment=$.s('Increment',$.r('Expression'),$.d('++'),$.d(';'))
const Decrement=$.s('Decrement',$.r('Expression'),$.d('--'),$.d(';'))
const BasicCommand=$.o('BasicCommand',
    $.r('VarDeclaration'),
    $.r('Call'),
    $.r('Return'),
    $.r('Break'),
    $.r('Continue'),
    $.r('Throw'),
    $.r('VM'),
    $.r('Increment'),
    $.r('Decrement'),
    $.r('Assign'),
    $.r('Expression')
    )
const Condition=$.s('Condition',$.t('(',$.r('Expression'),')'))
const IfStatement=$.s('IfStatement',$.d('if'),$.r('Condition'),$.r('Commands'),
    $.c($.d('else'),$.r('Commands')))
const WhileStatement=$.s('WhileStatement',$.d('while'),$.r('Condition'),$.r('Commands'))
const DoWhileStatement=$.s('DoWhileStatement',$.d('do'),$.r('Commands'),$.d('while'),$.r('Condition'),$.d(';'))
const ForStatement=$.s('ForStatement',$.d('for'),$.d('('),
    $.l('Init',$.r('VarDeclaration')),$.r('Expression'),$.d(';'),$.l('Step',$.r('BasicCommand')),
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
    BitAndAssign,
    BitOrAssign,
    BitXorAssign,
    BitShlAssign,
    BitShrAssign,
    Assign,
    VarDeclaration,
    Call,
    Return,
    Break,
    Continue,
    Throw,
    VM,
    Increment,
    Decrement,
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