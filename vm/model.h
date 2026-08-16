#ifndef SLANG_MODEL_H
#define SLANG_MODEL_H
#include <bit>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>
class VarPool;
using CommandType = void(*)(int, int, int, int);
using CommandList=std::vector<CommandType>;
template <typename T>
class Stack
{
private:
    std::vector<T> data;
    int index=0;
public:
    void push(T value)
    {
        data[index++]=value;
    }
    T pop()
    {
        return data[index--];
    }
    T peek(){
        return data[index];
    }
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
public:
    void delete_(const int id)
    {
        if (type[id])
        {
            refCount[id]--;
            if (refCount[id]==0)
                gcList.push_back(id);
        }
        if (!type[id])
        {
            refCount[id]--;
            if (refCount[id]==0)
                gcList.push_back(id);
        }
    }
    int link(const std::string& v)
    {
        if (const auto it = strI.find(v); it != strI.end()) {
            refCount[it->second]++;
            return it->second;
        }
        int id = nextId++;
        type[id]=false;
        auto [node, ok] = string.emplace(id, v);
        strI.emplace(std::string_view(node->second), id);
        refCount[id] = 1;
        return id;
    }
    int link(const double v)
    {
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
        return id;
    }
    void init(std::unordered_map<int,double> num,std::unordered_map<int,std::string> str)
    {
        number=std::move(num);
        string=std::move(str);
        //构造反表
        for (const auto& [key,value]:number)
        {
            type[key]=true;
            numI.emplace(std::bit_cast<uint64_t>(value),key);
        }
        for (const auto& [key,value]:string)
        {
            type[key]=false;
            strI.emplace(value,key);
        }
    }
    void gc()
    {
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
        }
        gcList.clear();
    }
};
using TaskCond=struct
{
    //var
    int id;
    bool prefix;
    //可能的offset
    int offset;
    //可能的name
    std::string name;
};
using TaskRun=void(*)(void(*)(VarPool*,int,int),void(*)(VarPool*,int,int,int),void(*)(VarPool*,int,const std::string&,int),int,int);
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
public:
    static void lock_var(VarPool* data,const int id)
    {
        if (!data->var_lock[id])
            data->var_lock[id]=true;
    }
    static void unlock_var(VarPool* data,const int id)
    {
        if (data->var_lock[id])
            data->var_lock[id]=false;
        //找出第一个task_queue检查
        if (!data->task_queue.empty())
            data->oper(data->task_queue.front());
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
            data->oper(data->task_queue.front());
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
            data->oper(data->task_queue.front());
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
        data->var[id]=value;
    }
    static void unsafeWriteOffset(VarPool* data,const int id, const int off, const int value)
    {
        data->offset[id][off]=value;
    }
    static void unsafeWriteName(VarPool* data,const int id, const std::string& n, const int value)
    {
        data->name[id][n]=value;
    }
    static int unsafeReadVar(VarPool* data,const int id)
    {
        return data->var[id];
    }
    static int unsafeReadOffset(VarPool* data,const int id, const int off)
    {
        return data->offset[id][off];
    }
    static int unsafeReadName(VarPool* data,const int id, const std::string& n)
    {
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
    void run(const Task& data)
    {
        int a[2];
        int index=0;
        for (const auto& [id, prefix, off, n] : data.cond)
        {
            a[index]=prefix?(off==-1?readName(this,id,n):readOffset(this,id,off)):readVar(this,id);
            index++;
        }
        data.run(writeVar,writeOffset,writeName,a[0],a[1]);
    }
    bool cond(const TaskCond& cond)
    {
        return !(cond.prefix?(cond.offset==-1?name_lock[cond.id][cond.name]:offset_lock[cond.id][cond.offset]):var_lock[cond.id]);
    }
};
#endif