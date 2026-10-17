#include "main.h"
std::filesystem::path tou8(const std::string& path)
{
    return std::filesystem::u8path(path);
}
void util::init()
{
#ifdef _WIN32
    std::ios::sync_with_stdio(false);
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    static WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif
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
util::Net::Net(const std::string& addr) : host(addr)
{
    const auto pos = addr.rfind(':');
    if (pos == std::string::npos) return;
    const std::string h = addr.substr(0, pos);
    const std::string p = addr.substr(pos + 1);

    addrinfo hints{};
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    addrinfo* res = nullptr;
    if (getaddrinfo(h.c_str(), p.c_str(), &hints, &res) != 0) return;

    fd = ::socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (fd != kInvalidSocket)
    {
#if defined(__APPLE__)
        int on = 1;
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, sizeof(on));
#endif
        if (::connect(fd, res->ai_addr, static_cast<int>(res->ai_addrlen)) != 0)
            close();
    }
    freeaddrinfo(res);
}
util::Net::~Net()
{
    close();
}
void util::Net::close()
{
    if (fd == kInvalidSocket) return;
#ifdef _WIN32
    ::closesocket(fd);
#else
    ::close(fd);
#endif
    fd = kInvalidSocket;
}
std::string util::Net::send(const std::string& data)
{
    if (fd == kInvalidSocket) return "not connected";
    const char* ptr = data.data();
    size_t remain = data.size();
    int flags = 0;
#if defined(__linux__)
    flags = MSG_NOSIGNAL;
#endif
    while (remain > 0)
    {
        const int n = ::send(fd, ptr, static_cast<int>(remain), flags);
        if (n <= 0) { close(); return "send failed"; }
        ptr += n;
        remain -= static_cast<size_t>(n);
    }
    return "";
}
std::string util::Net::recv(const int& n)
{
    std::string buf;
    if (fd == kInvalidSocket || n <= 0) return buf;
    buf.reserve(static_cast<size_t>(n));
    int remain = n;
    char tmp[4096];
    while (remain > 0)
    {
        const int toRead = remain < static_cast<int>(sizeof(tmp)) ? remain : static_cast<int>(sizeof(tmp));
        const int r = ::recv(fd, tmp, toRead, 0);
        if (r <= 0) { close(); break; }
        buf.append(tmp, static_cast<size_t>(r));
        remain -= r;
    }
    return buf;
}
util::NetPool::NetPool() = default;
util::NetPool::~NetPool()
{
    nets.clear();
}
int util::NetPool::connect(const std::string& addr)
{
    static int nextId = 1;
    Net n(addr);
    if (!n.connected()) return -1;
    const int id = nextId++;
    nets.emplace(id, std::move(n));
    return id;
}
std::string util::NetPool::send(const int& id, const std::string& data)
{
    const auto it = nets.find(id);
    if (it == nets.end()) return "unknown handle";
    return it->second.send(data);
}
void util::NetPool::close(const int& id)
{
    nets.erase(id);
}