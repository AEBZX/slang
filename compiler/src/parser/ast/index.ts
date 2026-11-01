import expr from './expr'
import command from './command'
import identifier from './identifier'
import block from './block'
import {ast_data, ast_generate, Parser as $, slang_ast_generate} from '../../utils'
export default new Map<any,ast_generate>([...expr,...command,...identifier,...block])