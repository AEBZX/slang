link math as std.math
public std:module{
    public type:module{
        public static toFixed:number(value:number,fixed:number){
            return value*math.pow(10,fixed)%1/math.pow(10,fixed);
        }
        private static map:string[]=[0:'0',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9'];
        public static valueOf:string(value:number){
            var r:number[];
            //提取位数
            var index:number=0;
            while (value>0){
                r[index]=value%10;
                value/=10;
                index++;
            }
            var ret:string='';
            for(var i:r)String.add(ret,std.type.map[i]);
            return ret;
        }
        public String:class{
            public len:number;
            public data:string;
            public static add:string(s1:string,s2:string){
                var _len:number=length(s1);
                var _len2:number=length(s2);
                for(var i=0;i<_len2;i++)
                    s1[i+_len]=s2[i];
                return s1;
            }
            public static length:number(s:string){
                var length:number=0;
                for(var i:s)length++;
                return length;
            }
            public substring:void(start:number,end:number){
                var ret:string='';
                for(var i=start;i<end;i++){
                    ret[i-start]=this.data[i];
                }
                ret.len=end-start;
                this.data=ret;
            }
            public replace:void(data:string,rep:string){
                var ret:string[]=split(data);
                var _r:string;
                for(var i:ret)
                    _r=String.add(_r,rep);
                return _r;
            }
            public split:string[](spl:string){
                this._split_index=0;
                return this._split(this.data,spl);
            }
            var _split_index:number=0;
            private _split:string[](_data:string,spl:string){
                var ret:string[]=[];
                var index:number=0;
                var _len:number=length(_data);
                //维护滑动窗口递归
                for(var i:number=0;i<this.len;i++){
                    var data:string=substring(i,i+_len);
                    if(data==spl){
                        ret[index]=substring(0,i);
                        index++;
                        this._split_index++;
                        var _ls:string[]=this._split(substring(i+_len,this.len),spl);
                        for(var j:number=0;j<this._split_index;j++)ret[index+j]=_ls[j];
                    }
                }
                return ret;
            }
            public appended:string(s:string){
                this.len+=s.len-1;
                return String.add(this.data,s);
            }
            public constructor(s:string){
                this.len = length(s);
                this.data = s;
            }
        }
    }
}