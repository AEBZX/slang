public std:module{
    public type:module{
        //四舍五入保留 fixed 位小数。
        //不能用 % 分离小数:VM 的 mod 是整数取模((int)l%(int)r),25.6%1=0;
        //用 |0 按位或把 double 截断成 int32 得到整数部分
        public static toFixed:number(value:number,fixed:number){
            var p:number=std.math.pow(10,fixed);
            var t:number=value*p;
            var ti:number=t|0;
            var f:number=t-ti;
            var r:number=ti;
            if(f>=0.5)r+=1;
            if(f<=-0.5)r-=1;
            return r/p;
        }
        //字符串长度:逐字符计数(语言无 length 内置)
        public static length:number(s:string){
            var n:number=0;
            foreach(c:s){n+=1;}
            return n;
        }
        //取第 index 个字符(越界返回 null)
        public static charAt:string(s:string,index:number){
            return s[index];
        }
    }
}
