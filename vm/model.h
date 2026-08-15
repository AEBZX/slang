#ifndef SLANG_MODEL_H
#define SLANG_MODEL_H
#include <bit>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>
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
            if (refCount[id]<=0)
                gcList.push_back(id);
        }
        if (!type[id])
        {
            refCount[id]--;
            if (refCount[id]<=0)
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
using VarTaskCond=struct
{
    //var
    int id;
    //可能的offset
    int offset;
    //可能的name
    std::string name;
};
using Task=void(*)(void(*)(int,int),void(*)(int,int,int),void(*)(int,std::string,int),int,int);
class VarPool
{
private:
    std::unordered_map<int,int> var;
    std::unordered_map<int,std::unordered_map<int,int>> offset;
    std::unordered_map<int,std::unordered_map<std::string,int>> name;
    std::unordered_map<int,bool> var_lock;
    std::unordered_map<int,std::unordered_map<int,bool>> offset_lock;
    std::unordered_map<int,std::unordered_map<std::string,bool>> name_lock;
    //var任务队列,任务队列需要ID,根据ID任务队列可以依赖若干任务ID,从而实现add c a b的同步,任务队列入c,a,b,等待a,b均无锁,读a,b,锁c,c=a+b,解锁c
public:
    void lock_var(const int id)
    {
    }
    void unlock_var(const int id)
    {
    }
    void setValue(const int id, const int value)
    {
        var[id]=value;
    }
    void setOffset(const int id, const int off, const int value)
    {
        offset[id][off]=value;
    }
    void setName(const int id,const std::string& n,const int off)
    {
        name[id][n]=off;
    }
    int getValue(const int id)
    {
        if (var.contains(id))return var[id];
        return -1;
    }
    int getOffset(const int id,const int off)
    {
        if (offset.contains(id) && offset[id].contains(off))return offset[id][off];
        return -1;
    }
    int getName(const int id,const std::string& n)
    {
        if (name.contains(id) && name[id].contains(n))return name[id][n];
        return -1;
    }
};
class PoolManage
{
};
#endif