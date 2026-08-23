#include "main.h"
#include <iostream>
#include <exception>
int main(int argc,const char* argv[])
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif
    if (argc >= 3 && std::string(argv[1]) == "run")
    {
        try {
            Manage m = entry(std::string(argv[2]),argv);
            m.start();
            return 0;
        } catch (const std::exception& e) {
            //未捕获异常会 terminate 崩溃退出(exit 3),捕获后打印友好错误并返回非零
            std::cerr << "error: " << e.what() << std::endl;
            return 1;
        }
    }
    std::cerr << "usage: vm run <sbin>" << std::endl;
    return 1;
}
