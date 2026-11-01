import {DataConfig, route, UserConfig} from '../model'
import {
    configUserPath,
    email_send,
    EmailBody,
    exists,
    get,
    random,
    readConfig,
    result,
    sha256,
    writeConfig
} from '../utils'
const Download:(path:string)=>route=(path:string)=>((res,req)=>{
    const {name,version} = req.body as {name:string,version:string}
    const config=readConfig<DataConfig>(path)
    if(!exists(name,config,version))return result(404)
    const ret=get(name,version,config)
    if(ret)return result(500)
    return result(200,'成功',{data:ret})
})