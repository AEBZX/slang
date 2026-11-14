import {Assign} from '../../utils'
import {slang_check_visitor} from '../tool'

const Type_Assign:slang_check_visitor=(ast:Assign,scope,call)=>{
    call(ast.data,3)
    call(ast.value,3)
}