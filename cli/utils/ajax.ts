import axios from 'axios'
import axiosRetry from 'axios-retry'
import {global_config} from './utils.ts'
const ajax=axios.create({
    baseURL:global_config().server,
    timeout:5000
})
axiosRetry(ajax,{
    retryDelay:(retryCount) => {
        return retryCount * 1000
    },
    retryCondition:axiosRetry.isNetworkOrIdempotentRequestError,
    retries:3
})
export default ajax
