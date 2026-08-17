#ifdef _WIN32
#include<windows.h>
#endif
#include "main.h"
int main(int argc, char* argv[])
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
#endif
    if (std::string(argv[1])=="run")
    {
        Manage m=entry(std::string(argv[2]));
        m.start();
    }
    return 0;
}