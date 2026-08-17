//parser.cpp(entry: .sbin 解析)集成测试
//构造真实格式的 sbin 字节流,验证解析正确性(魔数/常量池/分块)与错误路径
//测试名一律 ASCII
#include "main.h"
#include <catch2/catch_test_macros.hpp>

namespace {
//构造最小 sbin:POOL(id1=5.0数字, id2="abc"字符串) + block0[load,ret] + block_end
std::vector<char> build_sbin()
{
    std::vector<char> b;
    auto str = [&](const char* s) { for (; *s; s++) b.push_back(*s); };
    auto u32 = [&](const uint32_t v) { for (int i = 0; i < 4; i++) { b.push_back((char)(v >> (8 * i))); } };
    auto u8 = [&](const uint8_t v) { b.push_back((char)v); };
    str("POOL_START");
    u32(1); u8(1); u32(8);                        //id1 number
    const double d = 5.0;
    const char* dp = reinterpret_cast<const char*>(&d);
    for (int i = 0; i < 8; i++) b.push_back(dp[i]);
    u32(2); u8(0); u32(3); str("abc");            //id2 string
    str("POOL_END");
    str("CODE_START");
    u8(156); u32(0); u32(0); u32(0);              //block_start 0
    u8(84); u32(1); u32(1); u32(0);               //load: var[1]=pool[1]
    u8(122); u32(0); u32(0); u32(0);              //ret
    u8(158); u32(0); u32(0); u32(0);              //block_end
    str("CODE_END");
    return b;
}
std::string tmp_path(const char* name)
{
    return (fs::temp_directory_path() / name).string();
}
}

TEST_CASE("parser: valid sbin parses without error", "[parser]")
{
    const std::string path = tmp_path("slang_parser_ok.sbin");
    writeFile(path, build_sbin().data(), build_sbin().size());
    REQUIRE_NOTHROW(entry(path));
    fs::remove(path);
}

TEST_CASE("parser: bad magic throws", "[parser]")
{
    const std::string path = tmp_path("slang_parser_badmagic.sbin");
    std::vector<char> b = build_sbin();
    std::memcpy(b.data(), "XXX_START", 9);
    writeFile(path, b.data(), b.size());
    REQUIRE_THROWS(entry(path));
    fs::remove(path);
}

TEST_CASE("parser: truncated file throws", "[parser]")
{
    const std::string path = tmp_path("slang_parser_trunc.sbin");
    std::vector<char> b = build_sbin();
    b.resize(b.size() - 7);   //截断 CODE_END 前
    writeFile(path, b.data(), b.size());
    REQUIRE_THROWS(entry(path));
    fs::remove(path);
}

TEST_CASE("parser: missing file throws", "[parser]")
{
    REQUIRE_THROWS(entry(tmp_path("slang_parser_no_such.sbin")));
}

TEST_CASE("parser: instruction outside block throws", "[parser]")
{
    const std::string path = tmp_path("slang_parser_outblock.sbin");
    std::vector<char> b;
    auto str = [&](const char* s) { for (; *s; s++) b.push_back(*s); };
    auto u32 = [&](const uint32_t v) { for (int i = 0; i < 4; i++) b.push_back((char)(v >> (8 * i))); };
    auto u8 = [&](const uint8_t v) { b.push_back((char)v); };
    str("POOL_START"); str("POOL_END");
    str("CODE_START");
    u8(84); u32(1); u32(1); u32(0);   //指令在 block_start 之前
    str("CODE_END");
    writeFile(path, b.data(), b.size());
    REQUIRE_THROWS(entry(path));
    fs::remove(path);
}

TEST_CASE("parser: block not closed throws", "[parser]")
{
    const std::string path = tmp_path("slang_parser_unclosed.sbin");
    std::vector<char> b;
    auto str = [&](const char* s) { for (; *s; s++) b.push_back(*s); };
    auto u32 = [&](const uint32_t v) { for (int i = 0; i < 4; i++) b.push_back((char)(v >> (8 * i))); };
    auto u8 = [&](const uint8_t v) { b.push_back((char)v); };
    str("POOL_START"); str("POOL_END");
    str("CODE_START");
    u8(156); u32(0); u32(0); u32(0);   //block_start 后无 block_end
    str("CODE_END");
    writeFile(path, b.data(), b.size());
    REQUIRE_THROWS(entry(path));
    fs::remove(path);
}
