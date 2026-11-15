import block from './block'
import command from './command'
import expr from './expr'
export default new Map([...block,...command,...expr])