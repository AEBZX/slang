import axios from 'axios'
import axiosRetry from 'axios-retry'
import {global_config} from './utils.ts'
const ajax=axios.create({
    baseURL:global_config().server,
    //上传 VM/模块文件可达几十 MB,默认 5s 必然超时
    timeout:120000
})
axiosRetry(ajax,{
    retryDelay:(retryCount) => {
        return retryCount * 1000
    },
    retryCondition:axiosRetry.isNetworkOrIdempotentRequestError,
    retries:3
})
export default ajax
