public std:module{
    public math:module{
        public static pi:var:number=3.14159265358979323846;
        public static e:var:number=2.71828182845904523536;
        public static pow:number(a:number,b:number){
            var ret:number=1;
            for(var i:number=0;i<b;i++)ret*=a;
            return ret;
        }
        public static abs:number(num:number){
            if(num<0)num=-num;
            return num;
        }
        public static float_equal:boolean(a:number,b:number){
            return std.math.abs(a-b)<0.000000000001*std.math.max(a,b);
        }
        public static max:number(a:number,b:number){
            return a>b?a:b;
        }
        public static min:number(a:number,b:number){
            return a<b?a:b;
        }
    }
}
