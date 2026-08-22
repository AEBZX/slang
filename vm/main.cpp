#include "main.h"
int main(int argc,const char* argv[])
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif
    if (argc >= 3 && std::string(argv[1]) == "run")
    {
        Manage m = entry(std::string(argv[2]),argv);
        m.start();
    }
    return 0;
}
