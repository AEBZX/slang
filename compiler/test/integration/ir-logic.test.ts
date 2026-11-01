//集成:逻辑与/或的短路语义,以及 &&= / ||=
import {describe, expect, it} from 'vitest'
import {exec} from '../interpreter'
import {ir_of, opt_of} from '../unit/helper-ir'

const M = (body: string) => `public m:module{ public static f:number(a:number){ ${body} } }`
const run = (body: string, a = 0) => exec(ir_of(M(body)), [a]).ret
const run_opt = (body: string, a = 0) => exec(opt_of(M(body)), [a]).ret

//把布尔结果转成 0/1
const truth = (body: string, a = 0) => {
    const src = M(`var h:boolean=${body}; return h?1:0;`)
    const t = exec(ir_of(src), [a]).ret
    const o = exec(opt_of(src), [a]).ret
    expect(o, body + ' 优化前后不一致').toEqual(t)
    return t
}

describe('集成/逻辑·短路求值', () => {
    it('与:真真→真', () => expect(truth('(a>0)&&(a<10)', 5)).toBe(1))
    it('与:真假→假', () => expect(truth('(a>0)&&(a<3)', 5)).toBe(0))
    it('与:假(右侧不该被求值)', () => expect(truth('(a>10)&&(a<3)', 5)).toBe(0))

    it('或:真假→真', () => expect(truth('(a>0)||(a<0)', 5)).toBe(1))
    it('或:假假→假', () => expect(truth('(a>10)||(a<-10)', 5)).toBe(0))
    it('或:真(右侧不该被求值)', () => expect(truth('(a>0)||(a<0)', 5)).toBe(1))

    it('与/或嵌套', () => expect(truth('((a>0)||(a<-5))&&((a<10)||(a>100))', 5)).toBe(1))
})

describe('集成/逻辑·复合赋值', () => {
    it('&&= 左边真时取右边', () => {
        const body = 'var h:boolean=a>0; h&&=(a>1); return h?1:0;'
        expect(run(body, 5)).toBe(1)
        expect(run_opt(body, 5)).toBe(1)
    })

    it('&&= 左边为假时保持假', () => {
        const body = 'var h:boolean=a>0; h&&=(a>1); return h?1:0;'
        expect(run(body, 1)).toBe(0)
        expect(run_opt(body, 1)).toBe(0)
    })

    it('||= 左边为真时保持真', () => {
        const body = 'var h:boolean=a>0; h||=(a>1); return h?1:0;'
        expect(run(body, 5)).toBe(1)
        expect(run_opt(body, 5)).toBe(1)
    })

    it('||= 左边为假时取右边', () => {
        const body = 'var h:boolean=a>0; var g:boolean=a<10; h||=g; return h?1:0;'
        expect(run(body, -1)).toBe(1)
        expect(run_opt(body, -1)).toBe(1)
    })

    it('&&= / ||= 的结果是赋值后的值', () => {
        expect(run('var h:boolean=a>0; h||=(a>1); return h?1:0;', 1)).toBe(1)
        expect(run('var h:boolean=a>0; h&&=(a>5); return h?1:0;', 9)).toBe(1)
    })
})
