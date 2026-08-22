public std:module{
    public math:module{
        public static pi:number=3.14159265358979323846;
        public static e:number=2.71828182845904523536;
        public static pow:number(a:number,b:number){
            var ret=1;
            for(var i:number=0;i<b;i++)ret*=a;
            return ret;
        }
        public static abs(num:number){
            if(num<0)num=-num;
            return num;
        }
        public static float_equal(a:number,b:number){
            return abs(a-b)<pow(10,-12)*max(a,b);
        }
        public static max(a:number,b:number){
            return a>b?a:b;
        }
        public static min(a:number,b:number){
            return a<b?a:b;
        }
    }
}