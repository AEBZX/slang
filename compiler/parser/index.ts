import cst from './cst'
import ast from './ast'
import {ast_data, token} from '../utils'
export default function (token:token[]) {
    return ast(cst(token) as ast_data)
}