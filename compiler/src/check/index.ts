import censor from './censor'
import symbol from './symbol'
import build from './build'
import type from './type'
import Check from '../utils/lib/check'
import {Scope} from './tool'
export default new Check().use((param:any)=>new Scope(null,new Scope(null,null)))
.use([0,censor]).use([1,symbol]).use([2,build]).use([3,type])