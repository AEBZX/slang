#include "../main.h"
#include <bit>
#include <string_view>

namespace
{
    std::uint32_t be32(const char* p)
    {
        const auto* u=reinterpret_cast<const unsigned char*>(p);
        return static_cast<std::uint32_t>(u[0])<<24|
               static_cast<std::uint32_t>(u[1])<<16|
               static_cast<std::uint32_t>(u[2])<<8|
               static_cast<std::uint32_t>(u[3]);
    }
    std::uint64_t be64(const char* p)
    {
        return static_cast<std::uint64_t>(be32(p))<<32|be32(p+4);
    }
}
bool sbin::decode(const std::string& src,std::unordered_map<int,std::string>& string_pool,
    std::unordered_map<int,double>& number_pool,sbin::commands& command)
{
    constexpr std::uint32_t block_begin=0xFFFFFFFFu;
    constexpr std::uint32_t block_end=0xFFFFFFFEu;
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    sbin::commands commands;
    const std::string_view buf(src);
    std::size_t p=0;
    auto take=[&](const std::string_view tag)
    {
        if (buf.size()-p<tag.size()||buf.compare(p,tag.size(),tag)!=0)
            return false;
        p+=tag.size();
        return true;
    };
    if (!take("SLANG1.0.0")||!take("POOL_START"))
        return false;
    while (true)
    {
        if (take("POOL_END"))
            break;
        if (buf.size()-p<9)
            return false;
        const int id=static_cast<int>(be32(buf.data()+p));
        const auto type=static_cast<unsigned char>(buf[p+4]);
        const std::uint32_t len=be32(buf.data()+p+5);
        p+=9;
        if (buf.size()-p<len)
            return false;
        if (type==1)
        {
            if (len!=8)
                return false;
            if (!numbers.try_emplace(id,std::bit_cast<double>(be64(buf.data()+p))).second)
                return false;
        }
        else if (type==0)
        {
            if (!strings.try_emplace(id,buf.data()+p,len).second)
                return false;
        }
        else
            return false;
        p+=len;
    }
    if (!take("CODE_START"))
        return false;
    while (p<buf.size())
    {
        if (buf.size()-p<16||be32(buf.data()+p)!=block_begin)
            return false;
        const int id=static_cast<int>(be32(buf.data()+p+4));
        if (be32(buf.data()+p+8)!=0||be32(buf.data()+p+12)!=0)
            return false;
        p+=16;
        auto [it,inserted]=commands.try_emplace(id);
        if (!inserted)
            return false;
        auto& list=it->second;
        while (true)
        {
            if (buf.size()-p<16)
                return false;
            const std::uint32_t opcode=be32(buf.data()+p);
            const int arg1=static_cast<int>(be32(buf.data()+p+4));
            const int arg2=static_cast<int>(be32(buf.data()+p+8));
            const int arg3=static_cast<int>(be32(buf.data()+p+12));
            p+=16;
            if (opcode==block_end)
            {
                if (arg1!=0||arg2!=0||arg3!=0)
                    return false;
                break;
            }
            if (opcode==block_begin)
                return false;
            list.emplace_back(static_cast<int>(opcode),data::three_key<int,int,int>(arg1,arg2,arg3));
        }
    }
    string_pool=std::move(strings);
    number_pool=std::move(numbers);
    command=std::move(commands);
    return true;
}