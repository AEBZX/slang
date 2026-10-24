//单元测试:utils 的文件与目录接口
#include <catch2/catch_all.hpp>

#include <filesystem>
#include <string>

#include "../../main.h"

namespace
{
    //每个用例一个独立目录,避免互相污染
    struct temp_dir
    {
        std::filesystem::path path;
        temp_dir()
        {
            static int counter = 0;
            path = std::filesystem::temp_directory_path()
                / ("slang-utils-" + std::to_string(++counter) + "-"
                    + std::to_string(static_cast<unsigned long long>(
                        reinterpret_cast<std::uintptr_t>(this))));
            std::filesystem::remove_all(path);
            std::filesystem::create_directories(path);
        }
        ~temp_dir()
        {
            std::error_code ec;
            std::filesystem::remove_all(path, ec);
        }
        std::string str() const
        {
            return path.u8string().empty() ? std::string() : path.string();
        }
        std::string child(const std::string& name) const
        {
            return (path / name).string();
        }
    };
}

TEST_CASE("utils-file 文本写入再读回来一致", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("a.txt");
    const std::string text = "hello\nslang\n中文 тоже\n";
    REQUIRE(util::writeText(file, text));
    REQUIRE(util::exists(file));
    REQUIRE(util::isFile(file));
    REQUIRE_FALSE(util::isDir(file));
    REQUIRE(util::readText(file) == text);
}

TEST_CASE("utils-file 二进制写入再读回来逐字节一致", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("b.bin");
    std::string data;
    for (int i = 0; i < 256; ++i)
        data.push_back(static_cast<char>(i));
    data += std::string("\0\0tail", 6);
    REQUIRE(util::writeBinary(file, data));
    REQUIRE(util::readBinary(file) == data);
}

TEST_CASE("utils-file 空文件能写能读", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("empty.txt");
    REQUIRE(util::writeText(file, ""));
    REQUIRE(util::readText(file).empty());
    REQUIRE(util::isFile(file));
}

TEST_CASE("utils-file 读不存在的文件返回空串", "[utils]")
{
    temp_dir dir;
    REQUIRE(util::readText(dir.child("nope.txt")).empty());
    REQUIRE(util::readBinary(dir.child("nope.bin")).empty());
}

TEST_CASE("utils-file 写到不存在的父目录返回 false", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("no-such-dir/deep/a.txt");
    REQUIRE_FALSE(util::writeText(file, "x"));
    REQUIRE_FALSE(util::exists(file));
}

TEST_CASE("utils-file 目录的创建/判断/删除", "[utils]")
{
    temp_dir dir;
    const std::string sub = dir.child("sub");
    REQUIRE(util::mkdir(sub));
    REQUIRE(util::exists(sub));
    REQUIRE(util::isDir(sub));
    REQUIRE_FALSE(util::isFile(sub));
    //重复创建不算错
    REQUIRE(util::mkdir(sub));
    REQUIRE(util::rmdir(sub));
    REQUIRE_FALSE(util::exists(sub));
}

TEST_CASE("utils-file mkdir 会递归创建中间层", "[utils]")
{
    temp_dir dir;
    const std::string deep = dir.child("a/b/c/d");
    REQUIRE(util::mkdir(deep));
    REQUIRE(util::isDir(deep));
    REQUIRE(util::isDir(dir.child("a/b")));
}

TEST_CASE("utils-file rmdir 会删掉整棵子树", "[utils]")
{
    temp_dir dir;
    const std::string deep = dir.child("x/y");
    REQUIRE(util::mkdir(deep));
    REQUIRE(util::writeText((std::filesystem::path(deep) / "f.txt").string(), "1"));
    REQUIRE(util::rmdir(dir.child("x")));
    REQUIRE_FALSE(util::exists(dir.child("x")));
}

TEST_CASE("utils-file remove 删文件但不删目录", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("one.txt");
    REQUIRE(util::writeText(file, "1"));
    REQUIRE(util::remove(file));
    REQUIRE_FALSE(util::exists(file));
    //对目录用 remove 不成立(它只删空目录,这里目录非空)
    const std::string sub = dir.child("sub");
    REQUIRE(util::mkdir(sub));
    REQUIRE(util::writeText((std::filesystem::path(sub) / "k.txt").string(), "1"));
    REQUIRE_FALSE(util::remove(sub));
    REQUIRE(util::isDir(sub));
}

TEST_CASE("utils-file 删除不存在的路径返回 false", "[utils]")
{
    temp_dir dir;
    REQUIRE_FALSE(util::remove(dir.child("ghost.txt")));
    REQUIRE_FALSE(util::rmdir(dir.child("ghost-dir")));
}

TEST_CASE("utils-file list 只给直接子项名字并包含文件与目录", "[utils]")
{
    temp_dir dir;
    REQUIRE(util::writeText(dir.child("a.txt"), "1"));
    REQUIRE(util::writeText(dir.child("b.txt"), "2"));
    REQUIRE(util::mkdir(dir.child("sub")));

    auto names = util::list(dir.str());
    std::sort(names.begin(), names.end());
    REQUIRE(names.size() == 3);
    REQUIRE(names[0] == "a.txt");
    REQUIRE(names[1] == "b.txt");
    REQUIRE(names[2] == "sub");
}

TEST_CASE("utils-file list 不递归、不存在的路径给空表", "[utils]")
{
    temp_dir dir;
    REQUIRE(util::mkdir(dir.child("sub")));
    REQUIRE(util::writeText((std::filesystem::path(dir.child("sub")) / "inner.txt").string(), "1"));
    auto names = util::list(dir.str());
    REQUIRE(names.size() == 1);
    REQUIRE(names[0] == "sub");

    REQUIRE(util::list(dir.child("nope")).empty());
    //对文件调用 list 也是空表
    REQUIRE(util::writeText(dir.child("f.txt"), "1"));
    REQUIRE(util::list(dir.child("f.txt")).empty());
}

TEST_CASE("utils-file 覆盖写入是整体替换", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("c.txt");
    REQUIRE(util::writeText(file, "0123456789"));
    REQUIRE(util::writeText(file, "abc"));
    REQUIRE(util::readText(file) == "abc");
}

TEST_CASE("utils-file 中文与空格路径可用", "[utils]")
{
    temp_dir dir;
    const std::string file = dir.child("中文 目录 名字.txt");
    const std::string text = "内容 content";
    REQUIRE(util::writeText(file, text));
    REQUIRE(util::readText(file) == text);
    REQUIRE(util::isFile(file));
    const auto names = util::list(dir.str());
    REQUIRE(names.size() == 1);
    REQUIRE(names[0] == "中文 目录 名字.txt");
}

TEST_CASE("utils-file exists 对不存在的盘符路径不抛异常", "[utils]")
{
    //Windows 上不存在的盘符会让 filesystem 抛错,这里要求实现只返回 false
    const std::string ghost = std::string("Z:/slang-not-here/") + std::to_string(
        reinterpret_cast<std::uintptr_t>(&ghost));
    REQUIRE_FALSE(util::exists(ghost));
    REQUIRE_FALSE(util::isFile(ghost));
    REQUIRE_FALSE(util::isDir(ghost));
    REQUIRE(util::list(ghost).empty());
}

TEST_CASE("utils-file cwd 与 homedir 给出可用路径", "[utils]")
{
    const std::string here = util::cwd();
    REQUIRE_FALSE(here.empty());
    REQUIRE(util::isDir(here));
    const std::string home = util::homedir();
    REQUIRE_FALSE(home.empty());
    REQUIRE(util::isDir(home));
}
