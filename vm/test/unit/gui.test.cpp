//GUI(oper='GUI')窗口测试:show() 打开 Webview 窗口渲染 HTML
//依赖:对应平台 GUI 后端(Windows WebView2 / Linux WebKitGTK / macOS WKWebView)+ 显示环境
//WebView2 在部分 Windows 会话会内部崩溃、WebKitGTK 在 WSL/无用户命名空间环境创建首个
//WebView 会 abort——均为官方运行时/环境限制,与 VM 代码无关。默认跳过全部 GUI 测试,
//设 SLANG_GUI_TEST=1 强制运行(在 GUI 环境正常的机器上)
//测试名一律 ASCII
#include "gui.h"
#include <catch2/catch_test_macros.hpp>
#include <chrono>
#include <cstdlib>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#endif

namespace {
bool gui_test_enabled()
{
    const char* e = std::getenv("SLANG_GUI_TEST");
    return e && *e;
}
bool wait_for(const auto& pred, const int ms)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(ms);
    while (std::chrono::steady_clock::now() < deadline)
    {
        if (pred()) return true;
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    return pred();
}
}   // namespace

TEST_CASE("gui: utf8 to wide conversion", "[gui]")
{
    //不依赖显示环境/GUI 后端的纯逻辑测试(Windows 后端用它转换标题与 HTML)
    REQUIRE(gui::utf8_to_wide("abc") == std::wstring(L"abc"));
    const std::wstring zh = gui::utf8_to_wide("中文标题");
    REQUIRE(zh.size() == 4);
    REQUIRE(static_cast<unsigned>(zh[0]) == 0x4E2Du);
    REQUIRE(static_cast<unsigned>(zh[3]) == 0x9898u);
    //补充平面:Windows(wchar_t=2字节)需要代理对,Unix 直接一个码位
    const std::wstring emoji = gui::utf8_to_wide("\xF0\x9F\x9A\x80");   //U+1F680 🚀
#ifdef _WIN32
    REQUIRE(emoji.size() == 2);
    REQUIRE(static_cast<unsigned>(emoji[0]) == 0xD83Du);
    REQUIRE(static_cast<unsigned>(emoji[1]) == 0xDE80u);
#else
    REQUIRE(emoji.size() == 1);
    REQUIRE(static_cast<unsigned>(emoji[0]) == 0x1F680u);
#endif
    //非法字节 → U+FFFD,不能吞掉后续内容
    const std::wstring bad = gui::utf8_to_wide("a\xFF" "b");
    REQUIRE(bad.size() == 3);
    REQUIRE(bad[0] == L'a');
    REQUIRE(static_cast<unsigned>(bad[1]) == 0xFFFDu);
    REQUIRE(bad[2] == L'b');
    //截断的多字节序列也要安全(不越界)
    REQUIRE(gui::utf8_to_wide("\xE4\xB8").size() == 1);
}

TEST_CASE("gui: webview window opens and renders html", "[gui]")
{
    if (!gui_test_enabled())
        SKIP("GUI 测试默认跳过(WebView2/WebKitGTK 部分环境不稳定),设 SLANG_GUI_TEST=1 运行");
    if (!gui::available())
        SKIP("GUI 后端不可用(无 WebView2/WebKitGTK/WKWebView 或显示环境),跳过 GUI 测试");
    const std::string title = "slang-gui-test";
    REQUIRE(gui::show(title, "<html><body><h1>slang gui</h1></body></html>"));
    //窗口异步创建(约毫秒级)
    REQUIRE(wait_for([&]{ return gui::window_count() >= 1; }, 10000));
#ifdef _WIN32
    REQUIRE(FindWindowW(L"SlangWebviewWnd", L"slang-gui-test") != nullptr);
#endif
    //WebView 环境初始化并加载 HTML(首次初始化可能较慢)
    REQUIRE(wait_for([&]{ return gui::loaded_count() >= 1; }, 20000));
    //关闭全部窗口后窗口数归零
    gui::close_all();
    REQUIRE(wait_for([&]{ return gui::window_count() == 0; }, 10000));
}

TEST_CASE("gui: multiple windows tracked independently", "[gui]")
{
    if (!gui_test_enabled())
        SKIP("GUI 测试默认跳过(WebView2/WebKitGTK 部分环境不稳定),设 SLANG_GUI_TEST=1 运行");
    if (!gui::available())
        SKIP("GUI 后端不可用,跳过 GUI 测试");
    REQUIRE(gui::show("slang-gui-a", "<html>a</html>"));
    REQUIRE(gui::show("slang-gui-b", "<html>b</html>"));
    REQUIRE(wait_for([&]{ return gui::window_count() >= 2; }, 10000));
#ifdef _WIN32
    REQUIRE(FindWindowW(L"SlangWebviewWnd", L"slang-gui-a") != nullptr);
    REQUIRE(FindWindowW(L"SlangWebviewWnd", L"slang-gui-b") != nullptr);
#endif
    gui::close_all();
    REQUIRE(wait_for([&]{ return gui::window_count() == 0; }, 10000));
}
