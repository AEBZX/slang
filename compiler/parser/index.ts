import AST from './ast'
import CST from './cst'
import {CSTStream, ASTStream, token, cst_data} from '../utils'
export default function (code:token[]){
    let c=CST(new CSTStream(code)) as cst_data[]
    return AST(new ASTStream(c))
}