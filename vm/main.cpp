#include "main.h"
static std::string acp_to_utf8(const char* s) {
#ifdef _WIN32
    if (!s) return {};
    const int wlen = MultiByteToWideChar(CP_ACP, 0, s, -1, nullptr, 0);
    std::wstring w(wlen, L'\0');
    MultiByteToWideChar(CP_ACP, 0, s, -1, &w[0], wlen);
    const int len = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string u8(len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, &u8[0], len, nullptr, nullptr);
    if (!u8.empty() && u8.back() == '\0') u8.pop_back();
    return u8;
#endif
    return s;
}
int main(const int argc, char** argv)
{
    std::vector<std::string> args;
    for (int i=0;i<argc;i++)
        args.push_back(acp_to_utf8(argv[i]));
    util::init(args);
    if (args.size()<2)
    {
        std::cout<<"不能执行滚木";
        return 0;
    }
    std::unordered_map<int,std::string> strings;
    std::unordered_map<int,double> numbers;
    sbin::commands commands;
    int max_id=0;
    if (!sbin::decode(util::readBinary(args[1]),strings,numbers,commands,max_id))
        return 1;
    //分发表得先填好,Manage 构造时才取得到每条指令的实现
    instruction::init();
    runtime::Manage manage(strings,numbers,std::move(commands),max_id);
    manage.start();
    return 0;
}