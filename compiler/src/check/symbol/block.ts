import {slang_check_visitor} from '../tool'
import {File, Module} from '../../utils'
const Symbol_File:slang_check_visitor=(ast:File,scope,call)=> {
    scope = scope.enter()
    for (const link of ast.links) {
        if (!scope.global.get(link.module.join('.')))
            scope.thr('link的模块不存在', link)
        scope.set(link.as, scope.global.get(link.module.join('.')))
    }
    //前置定义防止找不到
    for (const item of ast.children)
        scope.set(item.name, item)
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}
const Symbol_Module:slang_check_visitor=(ast:Module,scope,call)=>{
    scope=scope.enter()
    for(const item of ast.children)
        scope.set(item.name,item)
    for(const item of ast.children)
        call(item,2)
    scope=scope.leave()
}