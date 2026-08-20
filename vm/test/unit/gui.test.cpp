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
