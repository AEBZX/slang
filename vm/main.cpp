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
    return 0;
}