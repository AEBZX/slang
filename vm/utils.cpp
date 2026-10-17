#include "main.h"
std::filesystem::path tou8(const std::string& path)
{
    return std::filesystem::u8path(path);
}
void util::init()
{
    std::ios::sync_with_stdio(false);
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
}
void util::print(const std::string& data)
{
    std::cout<<data<<std::endl;
}

std::string util::input()
{
    std::string ret;
    std::getline(std::cin,ret);
    return ret;
}

bool util::writeText(const std::string& path, const std::string& text)
{
    std::ofstream out(tou8(path));
    if (!out)return false;
    out<<text;
    out.close();
    return static_cast<bool>(out);
}

std::string util::readText(const std::string& path)
{
    std::ifstream in(tou8(path));
    std::stringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

bool util::writeBinary(const std::string& path, const std::string& binary)
{
    std::ofstream out(tou8(path), std::ios::binary);
    if (!out)return false;
    out<<binary;
    out.close();
    return static_cast<bool>(out);
}

std::string util::readBinary(const std::string& path)
{
    std::ifstream in(tou8(path), std::ios::binary);
    std::stringstream ss;
    ss << in.rdbuf();
    return ss.str();
}
std::string util::cwd() {
    std::error_code ec;
    const std::filesystem::path p = std::filesystem::current_path(ec);
    if (ec) return {};
    return p.string();
}
std::string util::homedir() {
#ifdef _WIN32
    if (const char* h = std::getenv("USERPROFILE"); h && *h)
        return h;
#else
    if (const char* h = std::getenv("HOME"); h && *h)
        return h;
#endif
    return {};
}
std::vector<std::string> util::list(const std::string& path) {
    std::vector<std::string> names;
    std::error_code ec;
    auto u8p = std::u8string(reinterpret_cast<const char8_t*>(path.data()), path.size());
    for (auto& e : std::filesystem::directory_iterator(std::filesystem::path(u8p), ec)) {
        auto u8 = e.path().filename().u8string();
        names.emplace_back(reinterpret_cast<const char*>(u8.data()), u8.size());
    }
    return names;
}

bool util::mkdir(const std::string& path)
{
    return std::filesystem::create_directories(tou8(path));
}

bool util::rmdir(const std::string& path)
{
    return std::filesystem::remove_all(tou8(path))>0;
}

bool util::remove(const std::string& path)
{
    return std::filesystem::remove(tou8(path));
}

bool util::exists(const std::string& path)
{
    return std::filesystem::exists(tou8(path));
}

bool util::isFile(const std::string& path)
{
    return std::filesystem::is_regular_file(tou8(path));
}

bool util::isDir(const std::string& path)
{
    return std::filesystem::is_directory(tou8(path));
}
