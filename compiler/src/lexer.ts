import Lexer from './utils/lib/lexer'
import {tokens} from './utils'
export default new Lexer().use(tokens)