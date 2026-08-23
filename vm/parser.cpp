#include <cstring>

#include "main.h"
Manage entry(const std::string& path,const char* args[])
{
    std::vector<std::string> arg={};
    for (int i=3;args[i]!=nullptr;i++)
        arg.push_back(args[i]);
    const std::vector<char> data=readBinary(path);
    if (data.empty()) throw std::runtime_error("sbin读取失败:"+path);
    size_t pos=0;
    const size_t size=data.size();
    //校验魔数并跳过
    auto magic=[&](const char* tag,const size_t len)
    {
        if (pos+len>size || std::memcmp(data.data()+pos,tag,len)!=0)
            throw std::runtime_error(std::string("sbin魔数校验失败:")+tag);
        pos+=len;
    };
    auto need=[&](const size_t n)
    {
        if (pos+n>size) throw std::runtime_error("sbin文件截断");
    };
    magic("POOL_START",10);
    //常量池
    std::unordered_map<int,double> num;
    std::unordered_map<int,std::string> str;
    while (true)
    {
        if (pos+8<=size && std::memcmp(data.data()+pos,"POOL_END",8)==0)
        {
            pos+=8;
            break;
        }
        need(9);
        uint32_t id;
        std::memcpy(&id,data.data()+pos,4);
        const uint8_t type=static_cast<uint8_t>(data[pos+4]);
        uint32_t len;
        std::memcpy(&len,data.data()+pos+5,4);
        pos+=9;
        need(len);
        if (type==1)
        {
            if (len!=8) throw std::runtime_error("sbin常量池number长度非法");
            double v;
            std::memcpy(&v,data.data()+pos,8);
            num.emplace(static_cast<int>(id),v);
        }
        else if (type==0)
            str.emplace(static_cast<int>(id),std::string(data.data()+pos,len));
        else throw std::runtime_error("sbin常量池type非法");
        pos+=len;
    }
    //代码段
    magic("CODE_START",10);
    Command command;
    constexpr int BLOCK_START=156,BLOCK_END=158;
    int block=-1;
    while (true)
    {
        if (pos+8<=size && std::memcmp(data.data()+pos,"CODE_END",8)==0)
        {
            pos+=8;
            break;
        }
        need(13);
        std::array<int,4> c{};
        c[0]=static_cast<uint8_t>(data[pos]);
        std::memcpy(&c[1],data.data()+pos+1,4);
        std::memcpy(&c[2],data.data()+pos+5,4);
        std::memcpy(&c[3],data.data()+pos+9,4);
        pos+=13;
        if (c[0]==BLOCK_START)
        {
            block=c[1];
            command[block];   //预建空块,保证入口块/跳转目标可寻址
            continue;
        }
        if (c[0]==BLOCK_END)
        {
            block=-1;
            continue;
        }
        if (block<0) throw std::runtime_error("sbin指令出现在块外");
        command[block].push_back(c);
    }
    if (pos!=size) throw std::runtime_error("sbin文件存在残留字节");
    if (block>=0) throw std::runtime_error("sbin块未闭合");
    return Manage(num,str,command,r,arg);
}