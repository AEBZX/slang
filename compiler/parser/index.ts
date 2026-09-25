import cst from './cst'
import ast from './ast'
import {ast_data, Parser, token} from '../utils'
export default new Parser().use(cst).use(ast)