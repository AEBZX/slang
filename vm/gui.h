#ifndef SLANG_GUI_H
#define SLANG_GUI_H
#include <string>
//Webview GUI:按 docs/IN_OUT.md 的 GUI(oper='GUI')规范,把 HTML 文本渲染为窗口
//show() 异步打开窗口并立即返回,返回值仅表示请求已被接受(不保证窗口成功打开)
namespace gui {
    //打开一个渲染 html 的 Webview 窗口(异步,窗口在专用 GUI 线程创建)
    //  Windows: WebView2(需 SDK 的 Loader.dll **且**已安装 WebView2 运行时)
    //  Linux  : GTK3 + WebKitGTK    macOS: AppKit + WKWebView
    //返回 false 表示没有可用后端(或运行时缺失),调用方可安全忽略
    bool show(const std::string& title, const std::string& html);
    //GUI 是否可用(编译期开启 + 运行时组件/显示环境齐备)
    bool available();
    //测试辅助:当前打开的窗口数 / 关闭全部窗口 / 已成功渲染数
    int window_count();
    void close_all();
    int loaded_count();
    //UTF-8 → 宽字符(按平台 wchar_t 宽度:Windows 为 UTF-16 含代理对,Unix 为 UTF-32);
    //非法字节替换为 U+FFFD。Windows 后端必须用它转换标题/HTML ——
    //直接用 std::wstring(s.begin(),s.end()) 是逐字节放大,中文标题/HTML 会变成乱码
    std::wstring utf8_to_wide(const std::string& s);
}
#endif
