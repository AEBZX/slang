//std 的最小 fixture:让类/接口这些必须实现 std.ObjectInterface 的路径能被测试
//(真实 std 不在这个仓库里,测试自己提供一份最小实现)

export const STD_SOURCE = `public std:module{
    public ObjectInterface:interface{
        public toString:string();
    }
}
`

export const STD_IFACE = `public std:module{
    public ObjectInterface:interface{
        public toString:string();
    }
    public Countable:interface{
        public count:number();
    }
}
`
