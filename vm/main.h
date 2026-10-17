#ifndef SLANG_MAIN_H
#define SLANG_MAIN_H
#include <string>
#include <iostream>
#include<fstream>
#include<filesystem>
#include <unordered_map>
#include <vector>
#ifdef _WIN32
#include <windows.h>
#endif
namespace util{
    class Net
    {
    public:
        Net(const std::string&,const short&);
        ~Net();
        void send(const std::string&);
        void close();
    };
    class NetPool
    {
    public:
        NetPool();
        ~NetPool();
    private:
        std::unordered_map<int,Net> nets;
    };
    void print(const std::string&);
    std::string input();
    void init();
    bool writeText(const std::string&,const std::string&);
    bool writeBinary(const std::string&,const std::string&);
    std::string readText(const std::string&);
    std::string readBinary(const std::string&);
    bool mkdir(const std::string&);
    bool rmdir(const std::string&);
    bool remove(const std::string&);
    bool exists(const std::string&);
    bool isFile(const std::string&);
    bool isDir(const std::string&);
    std::vector<std::string> list(const std::string&);
    std::string cwd();
    std::string homedir();
}
#endif