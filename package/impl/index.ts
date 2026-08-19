import Config from './config'
import User from './user'
import Net from './net'
import API from '../api'
//混入成一个类
function applyMixins(derived: any, bases: any[]) {
    for (const base of bases) {
        for (const name of Object.getOwnPropertyNames(base.prototype)) {
            if (name === 'constructor') continue
            Object.defineProperty(derived.prototype, name,
                Object.getOwnPropertyDescriptor(base.prototype, name)!)
        }
    }
}
class APIImpl extends API{}
applyMixins(APIImpl, [Config, User, Net])
export default APIImpl