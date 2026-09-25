import Check from '../utils/lib/check'
import {Scope} from './tool'
import {Round0} from './censor'
import {Round1,Round2} from './symbol'
import {Round3,Round4} from './type'
export default new Check().use([0,Round0]).use([1,Round1]).use([2,Round2]).use([3,Round3]).use([4,Round4]).use(()=>{
    return new Scope(null,new Scope(null,null))
})