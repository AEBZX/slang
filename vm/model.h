#ifndef SLANG_MODEL_H
#define SLANG_MODEL_H
#include<map>
#include <string>
#include <vector>

class ConstPool
{
private:
    //池
    std::map<int,long double> number;
    std::map<int,std::string> string;
    //引用计数
    std::map<int,int> refCount;
    //gc列表
    std::vector<int> gcList;
public:
    void setValue(const int id, const long double value)
    {
        number[id]=value;
    }
    void setValue(const int id, const std::string& value)
    {
        string[id]=value;
    }
};
class VarPool
{
private:
public:
};
using FuncType = void(*)(int, int);
#endif