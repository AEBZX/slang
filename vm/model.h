#ifndef SLANG_MODEL_H
#define SLANG_MODEL_H
#include <bit>
#include <cstdint>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>
#include <mutex>
class VarPool;
template <typename T>
class Stack
{
private:
    std::vector<T> data;
public:
    void push(T value)
    {
        data.push_back(value);
    }
    T pop()
    {
        T value=data.back();
        data.pop_back();
        return value;
    }
    T peek(){
        return data.back();
    }
    [[nodiscard]] size_t size() const
    {
        return data.size();
    }
};
struct Const
{
    bool type{};
    //当实际值消失,一定是被gc了,此时一定不会被访问
    std::string_view str;
    double num{};
};
class ConstPool
{
private:
    //池
    std::unordered_map<int,double> number;
    std::unordered_map<int,std::string> string;
    std::unordered_map<std::string_view,int> strI;
    std::unordered_map<uint64_t,int> numI;
    //引用计数
    std::unordered_map<uint64_t,int> refCount;
    //gc列表
    std::vector<int> gcList;
    std::unordered_map<int,bool> type;
    int nextId=0;
    //线程安全:多线程(thread 指令)并发 link/delete_/get/gc 需互斥
    mutable std::mutex mtx;
public:
    void delete_(const int id)
    {
        std::lock_guard<std::mutex> lock(mtx);
        if (!type.contains(id)) return;   //未知id忽略
        refCount[id]--;
        if (refCount[id]==0)
            gcList.push_back(id);
    }
    int link(const std::string& v)
    {
        std::lock_guard<std::mutex> lock(mtx);
        if (const auto it = strI.find(v); it != strI.end()) {
            refCount[it->second]++;
            return it->second;
        }
        int id = nextId++;
        type[id]=false;
        auto [node, ok] = string.emplace(id, v);
        strI.emplace(std::string_view(node->second), id);
        refCount[id]=1;
        return id;
    }
    int link(const double v)
    {
        std::lock_guard<std::mutex> lock(mtx);
        auto k = std::bit_cast<uint64_t>(v);
        if (const auto it = numI.find(k); it != numI.end())
        {
            refCount[it->second]++;
            return it->second;
        }
        int id = nextId++;
        type[id]=true;
        number.emplace(id, v);
        numI.emplace(k, id);
        refCount[id]=1;
        return id;
    }
    void init(std::unordered_map<int,double> num,std::unordered_map<int,std::string> str)
    {
        number=std::move(num);
        string=std::move(str);
        //构造反表
        nextId = 0;
        for (const auto& [key,value]:number)
        {
            type[key]=true;
            numI.emplace(std::bit_cast<uint64_t>(value),key);
            refCount[key] = 1;   //装载即一次引用
            if (key >= nextId) nextId = key + 1;   //link 从装载最大id之后分配,避免撞车
        }
        for (const auto& [key,value]:string)
        {
            type[key]=false;
            strI.emplace(value,key);
            refCount[key] = 1;
            if (key >= nextId) nextId = key + 1;
        }
    }
    void gc()
    {
        //多线程(thread 指令)并发 gc 需互斥,否则与 link/delete_ 竞争导致崩溃
        std::lock_guard<std::mutex> lock(mtx);
        //查询gc列表进行删除
        for (const auto id:gcList)
        {
            if (type[id])
            {
                numI.erase(std::bit_cast<uint64_t>(number[id]));
                number.erase(id);
            }
            if (!type[id])
            {
                strI.erase(string[id]);
                string.erase(id);
            }
            type.erase(id);
            refCount.erase(id);   //清理引用计数残留
        }
        gcList.clear();
    }
    Const get(const int id)
    {
        //未知id返回空Const,避免operator[]向type/string插入垃圾条目
        std::lock_guard<std::mutex> lock(mtx);
        if (!type.contains(id)) return {};
        Const ret;
        ret.type=type[id];
        ret.num=0;
        if (ret.type) ret.num=number[id];
        else ret.str=string[id];
        return ret;
    }
};
struct TaskCond
{
    //var
    int id;
    bool prefix;
    //可能的offset
    int offset;
    //可能的name
    std::string name;
};
using TaskRun=void(*)(VarPool*,void(*)(VarPool*,int,int),void(*)(VarPool*,int,int,int),void(*)(VarPool*,int,const std::string&,int),int,int,int);
struct Task
{
    std::vector<TaskCond> cond;
    TaskRun run;
};
using TaskQueue=std::vector<Task>;
class VarPool
{
private:
    std::unordered_map<int,int> var;
    std::unordered_map<int,std::unordered_map<int,int>> offset;
    std::unordered_map<int,std::unordered_map<std::string,int>> name;
    std::unordered_map<int,bool> var_lock;
    std::unordered_map<int,std::unordered_map<int,bool>> offset_lock;
    std::unordered_map<int,std::unordered_map<std::string,bool>> name_lock;
    TaskQueue task_queue;
    //alloc 起点:基于 this 地址的随机高位(>=1<<30),远离编译器槽号/池id区间;单调递增+contains兜底保证不撞
    int nextId = 0;
    std::mutex alloc_mtx;
    //var/offset/name 并发访问互斥(thread 指令多线程共享 VarPool)
    mutable std::mutex vmtx;
    int alloc_base() const
    {
        return (int)(0x40000000 | (0x3FFFFFFF & (uintptr_t)this));
    }
public:
    ConstPool data;
    VarPool() : nextId(alloc_base()) {}
    //新建一个变量槽(offset_set 建成员变量用),返回其 var_id
    int alloc()
    {
        //多线程(thread 指令)并发 alloc 需互斥
        std::lock_guard<std::mutex> lock(alloc_mtx);
        while (var.contains(nextId) || offset.contains(nextId) || name.contains(nextId))
            nextId++;
        return nextId++;
    }
    //offset 键是否存在(避免 operator[] 误插)
    bool hasOffset(const int id,const int off) const
    {
        std::lock_guard<std::mutex> lock(vmtx);
        const auto it = offset.find(id);
        return it != offset.end() && it->second.contains(off);
    }
    void init(const std::unordered_map<int,double>& num, const std::unordered_map<int,std::string>& str)
    {
        data.init(num,str);
    }
    static void lock_var(VarPool* data,const int id)
    {
        if (!data->var_lock[id])
            data->var_lock[id]=true;
    }
    static void unlock_var(VarPool* data,const int id)
    {
        if (data->var_lock[id])
            data->var_lock[id]=false;
        while (!data->task_queue.empty())
        {
            const auto task=data->task_queue.front();
            for (const auto& c:task.cond)
                if (!data->cond(c))
                    return;
            data->task_queue.erase(data->task_queue.begin());
            data->oper(task);
        }
    }
    static void lock_offset(VarPool* data,const int id, const int off)
    {
        if (!data->offset_lock[id][off])
            data->offset_lock[id][off]=true;
    }
    static void unlock_offset(VarPool* data,const int id, const int off)
    {
        if (data->offset_lock[id][off])
            data->offset_lock[id][off]=false;
        if (!data->task_queue.empty())
        {
            const auto task=data->task_queue.front();
            data->task_queue.erase(data->task_queue.begin());
            data->oper(task);
        }
    }
    static void lock_name(VarPool* data,const int id, const std::string& n)
    {
        if (!data->name_lock[id][n])
            data->name_lock[id][n]=true;
    }
    static void unlock_name(VarPool* data,const int id, const std::string& n)
    {
        if (data->name_lock[id][n])
            data->name_lock[id][n]=false;
        if (!data->task_queue.empty())
        {
            auto task=data->task_queue.front();
            data->task_queue.erase(data->task_queue.begin());
            data->oper(task);
        }
    }
    static void writeVar(VarPool* data,const int id, const int value)
    {
        lock_var(data,id);
        data->var[id]=value;
        unlock_var(data,id);
    }
    static void writeOffset(VarPool* data,const int id, const int off, const int value)
    {
        lock_offset(data,id,off);
        data->offset[id][off]=value;
        unlock_offset(data,id,off);
    }
    static void writeName(VarPool* data,const int id, const std::string& n, const int value)
    {
        lock_name(data,id,n);
        data->name[id][n]=value;
        unlock_name(data,id,n);
    }
    static int readVar(VarPool* data,const int id)
    {
        lock_var(data,id);
        const int value=data->var[id];
        unlock_var(data,id);
        return value;
    }
    static int readOffset(VarPool* data,const int id, const int off)
    {
        lock_offset(data,id,off);
        const int value=data->offset[id][off];
        unlock_offset(data,id,off);
        return value;
    }
    static int readName(VarPool* data,const int id, const std::string& n)
    {
        lock_name(data,id,n);
        const int value=data->name[id][n];
        unlock_name(data,id,n);
        return value;
    }
    static void unsafeWriteVar(VarPool* data,const int id, const int value)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        data->var[id]=value;
    }
    static void unsafeWriteOffset(VarPool* data,const int id, const int off, const int value)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        data->offset[id][off]=value;
    }
    static void unsafeWriteName(VarPool* data,const int id, const std::string& n, const int value)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        data->name[id][n]=value;
    }
    static int unsafeReadVar(VarPool* data,const int id)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        return data->var[id];
    }
    static int unsafeReadOffset(VarPool* data,const int id, const int off)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        return data->offset[id][off];
    }
    static int unsafeReadName(VarPool* data,const int id, const std::string& n)
    {
        std::lock_guard<std::mutex> lock(data->vmtx);
        return data->name[id][n];
    }
    void oper(const Task& task)
    {
        auto has=true;
        for (const auto& c:task.cond)
            if (cond(c)==false)
            {
                has=false;
                break;
            }
        if (!has)task_queue.push_back(task);
        if (has)run(task);
    }
    void run(const Task& d)
    {
        //传原始操作数(reg=槽id, value=池id),由handler按opcode形式自行解析;不足补0
        int a[3]={0,0,0};
        int index=0;
        for (const auto& c : d.cond)
        {
            if (index>=3) break;
            a[index]=c.id;
            index++;
        }
        d.run(this,writeVar,writeOffset,writeName,a[0],a[1],a[2]);
    }
    bool cond(const TaskCond& cond)
    {
        return !(cond.prefix?(cond.offset==-1?name_lock[cond.id][cond.name]:offset_lock[cond.id][cond.offset]):var_lock[cond.id]);
    }
};
#endif