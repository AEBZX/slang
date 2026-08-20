#ifndef SLANG_GUI_H
#define SLANG_GUI_H
#include <string>
//Webview GUI:按 docs/IN_OUT.md 的 GUI(oper='GUI')规范,把 HTML 文本渲染为窗口
//show() 异步打开窗口并立即返回,返回值仅表示请求已被接受(不保证窗口成功打开)
namespace gui {
    //打开一个渲染 html 的 Webview 窗口;Windows 用 WebView2,其他平台暂未实现(返回 false)
    bool show(const std::string& title, const std::string& html);
    //GUI 是否可用(编译期开启且运行时组件可加载)
    bool available();
    //测试辅助:当前打开的窗口数 / 关闭全部窗口 / 已成功渲染数
    int window_count();
    void close_all();
    int loaded_count();
}
#endif
