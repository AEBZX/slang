#include "runtime.h"
static int field(Runtime* t, const int obj, const char* key)
{
    const int k = t->pool->data.link(std::string(key));
    const int vid = VarPool::unsafeReadOffset(t->pool, obj, k);
    return VarPool::unsafeReadVar(t->pool, vid);
}
static std::string field_str(Runtime* t, const int obj, const char* key)
{
    return std::string(t->pool->data.get(field(t, obj, key)).str);
}
static int field_num(Runtime* t, const int obj, const char* key)
{
    return (int)t->pool->data.get(field(t, obj, key)).num;
}
static void io_set(Runtime* t, const int pid)
{
    t->io_result = pid;
    t->io_wait_recv = false;
    t->io_array.clear();
}
static void out_file(Runtime* t, const int obj)
{
    const std::string type = field_str(t, obj, "type");
    const std::string name = field_str(t, obj, "name");
    if (type == "read")
    {
        const std::string mode = field_str(t, obj, "mode");
        if (mode == "bin")
        {
            const std::vector<char> bytes = readBinary(name);
            t->io_array.clear();
            for (const char ch : bytes)
                t->io_array.push_back(t->pool->data.link(static_cast<unsigned char>(ch)));
            t->io_result = -1;
            t->io_wait_recv = false;
        }
        else
            io_set(t, t->pool->data.link(readFile(name)));
    }
    else if (type == "write")
    {
        const std::string data = field_str(t, obj, "data");
        io_set(t, t->pool->data.link((double)(writeFile(name, data) ? 1 : 0)));
    }
    else if (type == "exist")
    {
        const std::string kind = field_str(t, obj, "name");
        bool ok = false;
        if (kind == "file") ok = isFile(name);
        else if (kind == "folder") ok = isFolder(name);
        else ok = exists(name);
        io_set(t, t->pool->data.link((double)(ok ? 1 : 0)));
    }
    else if (type == "create")
    {
        const std::string kind = field_str(t, obj, "name");
        const bool ok = kind == "folder" ? createDictionary(name) : createFile(name);
        io_set(t, t->pool->data.link((double)(ok ? 1 : 0)));
    }
    else if (type == "find")
    {
        const std::vector<std::string> names = children(name);
        t->io_array.clear();
        for (const auto& s : names)
            t->io_array.push_back(t->pool->data.link(s));
        t->io_result = -1;
        t->io_wait_recv = false;
    }
    else if (type == "delete")
    {
        const std::string kind = field_str(t, obj, "name");
        std::error_code ec;
        const bool ok = kind == "folder" ? fs::remove_all(name, ec) != 0 : fs::remove(name, ec);
        io_set(t, t->pool->data.link((double)(ok ? 1 : 0)));
    }
    else if (type=="dir")
    {
        const std::string kind=field_str(t,obj,"name");
        io_set(t, t->pool->data.link(kind=="cwd"?cwd():home()));
    }
}
static void out_shell(Runtime* t, const int obj)
{
    const std::string type = field_str(t, obj, "type");
    if (type == "print")
        console(field_str(t, obj, "data"));
    else if (type == "input")
    {
        std::string line;
        read(&line);
        io_set(t, t->pool->data.link(line));
    }
    else if (type == "shell")
    {
        exec(field_str(t, obj, "data"));
        io_set(t, t->pool->data.link(0.0));
    }
}
static void out_system(Runtime* t, const int obj)
{
    //system 端口的 data 是字符串常量(如 'disk'),obj 解析后即其池id
    const std::string key = std::string(t->pool->data.get(obj).str);
    double v = 0;
    if (key == "disk") v = (double)DiskNumber();
    else if (key == "memory_global") v = (double)MemoryNumber();
    else if (key == "core_num") v = (double)CPUNumber();
    else if (key == "memory_self") v = (double)Memory();
    io_set(t, t->pool->data.link(v));
}
static void out_net(Runtime* t, const int obj)
{
    const std::string type = field_str(t, obj, "type");
    if (type == "connect")
    {
        const std::string host = field_str(t, obj, "host");
        io_set(t, t->pool->data.link((double)t->m->net.connect(host)));
    }
    else if (type == "send")
    {
        const int id = field_num(t, obj, "id");
        const std::string data = field_str(t, obj, "data");
        t->m->net.send(id, data);   //out 不阻塞,只发送
        t->io_net_id = id;
        t->io_result = -1;
        t->io_wait_recv = true;     //in 时阻塞接收
    }
    else if (type == "close")
    {
        const int id = field_num(t, obj, "id");
        t->m->net.close(id);
        io_set(t, t->pool->data.link(1.0));
    }
}
static void out_port(Runtime* t, const int oper_pid, const int obj, const int fb)
{
    (void)fb;
    const std::string port = std::string(t->pool->data.get(oper_pid).str);
    //obj 已按 key 解析:file/shell/net 为对象句柄;system 为字符串池id(value 形式)
    if (port == "system") out_system(t, obj);
    else if (port == "file") out_file(t, obj);
    else if (port == "shell") out_shell(t, obj);
    else if (port == "net") out_net(t, obj);
    else io_set(t, t->pool->data.link(0.0));   //未知端口返回失败
}
static void in_port(Runtime* t, const int oper_pid, const int target)
{
    const std::string port = std::string(t->pool->data.get(oper_pid).str);
    if (port == "net" && t->io_wait_recv)
    {
        //net in 阻塞接收一行(逐字节读到 \n)
        std::string line;
        std::string buf;
        while (t->m->net.recv(t->io_net_id, 1, buf))
        {
            const char ch = buf[0];
            if (ch == '\n') break;
            line += ch;
        }
        VarPool::unsafeWriteVar(t->pool, target, t->pool->data.link(line));
        t->io_wait_recv = false;
        return;
    }
    if (!t->io_array.empty())
    {
        //数组结果:元素变量挂 offset[target][i]
        for (int i = 0; i < (int)t->io_array.size(); i++)
        {
            const int v = t->pool->alloc();
            VarPool::unsafeWriteVar(t->pool, v, t->io_array[i]);
            VarPool::unsafeWriteOffset(t->pool, target, i, v);
        }
        t->io_array.clear();
        return;
    }
    VarPool::unsafeWriteVar(t->pool, target, t->io_result);
    t->io_result = -1;
}
//操作数:oper 源(端口名,src);out 的 data 用 key(value→var[x] 取对象句柄);in 的 target 取原始槽号(写目标变量)
#define IO_F(fa, fb) \
void in_f##fa##fb(Runtime* t,int a,int b,int c){ (void)c;(void)fb; in_port(t, src(t->pool,fa,a), b); } \
void out_f##fa##fb(Runtime* t,int a,int b,int c){ (void)c; out_port(t, src(t->pool,fa,a), key(t->pool,fb,b), fb); }
IO_F(0,0) IO_F(0,1) IO_F(1,0) IO_F(1,1)
std::unordered_map<int,CommandRun> io()
{
    return {
        {148,in_f00},{149,in_f01},{150,in_f10},{151,in_f11},
        {152,out_f00},{153,out_f01},{154,out_f10},{155,out_f11},
    };
}