import {Build,Verify} from './block'
import expr from './expr'
import command from './command'
import identifier from './identifier'
export const Round1=Build
export const Round2=new Map([...expr,...Verify,...identifier,...command])
