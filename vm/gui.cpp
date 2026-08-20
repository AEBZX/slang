//GUI 实现:把 HTML 文本渲染为窗口(跨平台)
//  Windows: WebView2(Edge WebView2 Runtime);CMake 找到 SDK 时定义 SLANG_WEBVIEW2
//  Linux  : GTK3 + WebKitGTK(webkit2gtk-4.1/4.0)
//  macOS  : AppKit + WKWebView(本文件以 OBJCXX 编译)
//未找到对应依赖或非上述平台时,以占位实现返回失败(不影响 VM 其他功能)
#include "gui.h"
#include <atomic>
#include <chrono>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <vector>

#if defined(_WIN32) && defined(SLANG_WEBVIEW2)
    #define SLANG_GUI_WIN
#elif defined(__linux__) && defined(SLANG_WEBVIEW2)
    #define SLANG_GUI_GTK
#elif defined(__APPLE__) && defined(SLANG_WEBVIEW2)
    #define SLANG_GUI_COCOA
#endif

#if defined(SLANG_GUI_WIN)
#include <windows.h>
#include "WebView2.h"
#elif defined(SLANG_GUI_GTK)
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#elif defined(SLANG_GUI_COCOA)
#include <Cocoa/Cocoa.h>
#include <WebKit/WebKit.h>
#endif

//===== 共享骨架:一个专用 GUI 线程 + 命令队列,窗口生命周期全部在 GUI 线程 =====
namespace {
struct Job
{
    std::string title;
    std::string html;
};
struct Cmd
{
    enum Kind { OPEN, CLOSE_ALL } kind;
    Job job;
};
std::mutex g_mtx;
std::queue<Cmd> g_cmds;
std::vector<void*> g_windows;   //仅 GUI 线程写,读需持锁(测试线程 window_count)
std::thread g_thread;
bool g_started = false;
std::atomic<int> g_loaded{0};   //HTML 成功加载渲染的次数(测试断言用)

//===== 平台后端接口(各平台实现)=====
bool backend_available();
bool backend_init();
void* backend_create(const std::string& title, const std::string& html);   //GUI 线程
void backend_pump();                                                       //GUI 线程,非阻塞
void backend_destroy(void* w);                                             //GUI 线程

void gui_thread_main()
{
    if (!backend_init()) return;
    while (true)
    {
        std::vector<Cmd> cmds;
        {
            std::lock_guard<std::mutex> lock(g_mtx);
            while (!g_cmds.empty())
            {
                cmds.push_back(std::move(g_cmds.front()));
                g_cmds.pop();
            }
        }
        for (auto& c : cmds)
        {
            if (c.kind == Cmd::CLOSE_ALL)
            {
                //拷贝后逐个销毁;销毁回调会把句柄从 g_windows 移除
                std::vector<void*> ws;
                {
                    std::lock_guard<std::mutex> lock(g_mtx);
                    ws = g_windows;
                }
                for (void* w : ws) backend_destroy(w);
            }
            else
            {
                void* w = backend_create(c.job.title, c.job.html);
                if (w)
                {
                    std::lock_guard<std::mutex> lock(g_mtx);
                    g_windows.push_back(w);
                }
            }
        }
        backend_pump();
        bool idle;
        {
            std::lock_guard<std::mutex> lock(g_mtx);
            idle = g_windows.empty() && g_cmds.empty();
        }
        if (idle)
        {
            //无窗口无任务:退出线程,释放 GTK/WebKit 等资源,避免进程退出时后端断言崩溃
            std::lock_guard<std::mutex> lock(g_mtx);
            g_started = false;
            return;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}
void ensure_thread()
{
    std::lock_guard<std::mutex> lock(g_mtx);
    if (g_started) return;
    g_started = true;
    g_thread = std::thread(gui_thread_main);
    g_thread.detach();
}
void track_remove(void* w)
{
    std::lock_guard<std::mutex> lock(g_mtx);
    std::erase(g_windows, w);
}
}   // namespace

//===== Windows:Win32 + WebView2 =====
#if defined(SLANG_GUI_WIN)
namespace {
//接口 IID(WebView2.h 仅声明 extern,无定义文件;此处按 MIDL 声明的 GUID 手写)
static const IID IID_EnvHandler = {0x4e8a3389,0xc9d8,0x4bd2,{0xb6,0xb5,0x12,0x4f,0xee,0x6c,0xc1,0x4d}};
static const IID IID_CtrlHandler = {0x6c4819f3,0xc9b7,0x4260,{0x81,0x27,0xc9,0xf5,0xbd,0xe7,0xf6,0x8c}};
static const IID IID_Unknown = {0x00000000,0x0000,0x0000,{0xc0,0x00,0x00,0x00,0x00,0x00,0x00,0x46}};
using CreateEnvFn = HRESULT(__stdcall*)(PCWSTR, PCWSTR, void*,
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
CreateEnvFn load_create_env()
{
    static HMODULE mod = LoadLibraryW(L"WebView2Loader.dll");
    if (!mod) return nullptr;
    static CreateEnvFn fn = reinterpret_cast<CreateEnvFn>(
        GetProcAddress(mod, "CreateCoreWebView2EnvironmentWithOptions"));
    return fn;
}
class ControllerHandler;
//WebView2 异步回调:所有权交给运行时(refcount 1 起,Invoke 后由运行时释放)
class EnvHandler : public ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler
{
public:
    HWND hwnd;
    std::wstring html;
    std::atomic<ULONG> refs{1};
    EnvHandler(HWND h, std::wstring s) : hwnd(h), html(std::move(s)) {}
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override
    {
        if (riid == IID_Unknown || riid == IID_EnvHandler)
        {
            *ppv = static_cast<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }
    STDMETHODIMP_(ULONG) AddRef() override { return ++refs; }
    STDMETHODIMP_(ULONG) Release() override
    {
        if (--refs == 0) { delete this; return 0; }
        return refs;
    }
    //Invoke 延迟到 ControllerHandler 完整定义之后(见文件下方 create_controller_async)
    STDMETHODIMP Invoke(HRESULT result, ICoreWebView2Environment* env) override;
};
class ControllerHandler : public ICoreWebView2CreateCoreWebView2ControllerCompletedHandler
{
public:
    HWND hwnd;
    std::wstring html;
    std::atomic<ULONG> refs{1};
    ControllerHandler(HWND h, std::wstring s) : hwnd(h), html(std::move(s)) {}
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override
    {
        if (riid == IID_Unknown || riid == IID_CtrlHandler)
        {
            *ppv = static_cast<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }
    STDMETHODIMP_(ULONG) AddRef() override { return ++refs; }
    STDMETHODIMP_(ULONG) Release() override
    {
        if (--refs == 0) { delete this; return 0; }
        return refs;
    }
    STDMETHODIMP Invoke(HRESULT result, ICoreWebView2Controller* controller) override
    {
        if (SUCCEEDED(result) && controller)
        {
            ICoreWebView2* wv = nullptr;
            if (SUCCEEDED(controller->get_CoreWebView2(&wv)) && wv)
            {
                if (SUCCEEDED(wv->NavigateToString(html.c_str())))
                    g_loaded++;
                wv->Release();
            }
            controller->Release();
        }
        return S_OK;
    }
};
inline STDMETHODIMP EnvHandler::Invoke(HRESULT result, ICoreWebView2Environment* env)
{
    if (SUCCEEDED(result) && env)
        env->CreateCoreWebView2Controller(hwnd, new ControllerHandler(hwnd, html));
    if (env) env->Release();
    return S_OK;
}
void init_webview(HWND hwnd, const std::wstring& html)
{
    CreateEnvFn fn = load_create_env();
    if (!fn) return;
    fn(nullptr, nullptr, nullptr, new EnvHandler(hwnd, html));
}
LRESULT CALLBACK wnd_proc(HWND hwnd, UINT msg, WPARAM w, LPARAM l)
{
    if (msg == WM_DESTROY) track_remove(hwnd);
    return DefWindowProcW(hwnd, msg, w, l);
}
void register_class()
{
    static bool done = false;
    if (done) return;
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = wnd_proc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.lpszClassName = L"SlangWebviewWnd";
    RegisterClassExW(&wc);
    done = true;
}
bool backend_available() { return load_create_env() != nullptr; }
bool backend_init() { register_class(); return true; }
void* backend_create(const std::string& title, const std::string& html)
{
    const std::wstring wt(title.begin(), title.end());
    const std::wstring wh(html.begin(), html.end());
    HWND hwnd = CreateWindowExW(0, L"SlangWebviewWnd", wt.c_str(),
        WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 960, 640,
        nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
    if (!hwnd) return nullptr;
    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);
    init_webview(hwnd, wh);
    return hwnd;
}
void backend_pump()
{
    MSG msg;
    while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
}
void backend_destroy(void* w) { DestroyWindow(static_cast<HWND>(w)); }
}   // namespace

//===== Linux:GTK3 + WebKitGTK =====
#elif defined(SLANG_GUI_GTK)
namespace {
std::atomic<bool> g_gtk_ok{false};
std::once_flag g_gtk_once;
bool gtk_available()
{
    //gtk_init_check 只能在 GUI 线程初始化(GTK 非线程安全),故只在 backend_init 里调用
    std::call_once(g_gtk_once, []{ g_gtk_ok = gtk_init_check(nullptr, nullptr); });
    return g_gtk_ok.load();
}
bool backend_available()
{
    //仅探测显示环境,不做 GTK 初始化;无显示(WSL 无 WSLg / 无 X11)时不可用
    const char* d = std::getenv("DISPLAY");
    const char* w = std::getenv("WAYLAND_DISPLAY");
    return (d && *d) || (w && *w);
}
bool backend_init() { return gtk_available(); }
void on_load_changed(WebKitWebView*, WebKitLoadEvent ev, gpointer)
{
    if (ev == WEBKIT_LOAD_FINISHED) g_loaded++;
}
void on_destroy(GtkWidget* w, gpointer)
{
    track_remove(w);
}
void* backend_create(const std::string& title, const std::string& html)
{
    GtkWidget* win = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title(GTK_WINDOW(win), title.c_str());
    gtk_window_set_default_size(GTK_WINDOW(win), 960, 640);
    g_signal_connect(win, "destroy", G_CALLBACK(on_destroy), nullptr);
    GtkWidget* wv = webkit_web_view_new();
    gtk_container_add(GTK_CONTAINER(win), wv);
    g_signal_connect(wv, "load-changed", G_CALLBACK(on_load_changed), nullptr);
    gtk_widget_show_all(win);
    webkit_web_view_load_html(WEBKIT_WEB_VIEW(wv), html.c_str(), nullptr);
    return win;
}
void backend_pump()
{
    while (gtk_events_pending())
        gtk_main_iteration_do(FALSE);
}
void backend_destroy(void* w) { gtk_widget_destroy(GTK_WIDGET(w)); }
}   // namespace

//===== macOS:AppKit + WKWebView(本文件以 OBJCXX 编译)=====
//注意:NSWindow.delegate 与 WKWebView.navigationDelegate 均为弱引用,
//必须持有强引用,否则回调对象立即释放、事件永不触发;故用共享单例
#elif defined(SLANG_GUI_COCOA)
@interface SlangGuiDelegate : NSObject <NSWindowDelegate, WKNavigationDelegate>
@end
@implementation SlangGuiDelegate
- (void)windowWillClose:(NSNotification*)note
{
    track_remove((__bridge void*)note.object);
}
- (void)webView:(WKWebView*)webView didFinishNavigation:(WKNavigation*)navigation
{
    (void)webView; (void)navigation;
    g_loaded++;
}
@end
namespace {
SlangGuiDelegate* shared_delegate()
{
    static SlangGuiDelegate* d = [[SlangGuiDelegate alloc] init];
    return d;
}
bool backend_available() { return true; }
bool backend_init()
{
    [NSApplication sharedApplication];
    return true;
}
void* backend_create(const std::string& title, const std::string& html)
{
    @autoreleasepool
    {
        NSRect rect = NSMakeRect(0, 0, 960, 640);
        NSWindow* win = [[NSWindow alloc] initWithContentRect:rect
            styleMask:(NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                      NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable)
            backing:NSBackingStoreBuffered defer:NO];
        [win setTitle:[NSString stringWithUTF8String:title.c_str()]];
        [win setDelegate:shared_delegate()];
        WKWebView* wv = [[WKWebView alloc] initWithFrame:rect];
        [wv setNavigationDelegate:shared_delegate()];
        [[win contentView] addSubview:wv];
        [win makeKeyAndOrderFront:nil];
        [wv loadHTMLString:[NSString stringWithUTF8String:html.c_str()] baseURL:nil];
        return (__bridge_retained void*)win;
    }
}
void backend_pump()
{
    @autoreleasepool
    {
        NSDate* until = [NSDate dateWithTimeIntervalSinceNow:0.01];
        [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:until];
    }
}
void backend_destroy(void* w)
{
    @autoreleasepool
    {
        NSWindow* win = (__bridge_transfer NSWindow*)w;
        [win close];
    }
}
}   // namespace

//===== 占位:非上述平台或无依赖 =====
#else
namespace {
bool backend_available() { return false; }
bool backend_init() { return false; }
void* backend_create(const std::string&, const std::string&) { return nullptr; }
void backend_pump() {}
void backend_destroy(void*) {}
}   // namespace
#endif

//===== 公共 API =====
namespace gui {
bool show(const std::string& title, const std::string& html)
{
    if (!available()) return false;
    ensure_thread();
    Cmd c;
    c.kind = Cmd::OPEN;
    c.job.title = title;
    c.job.html = html;
    {
        std::lock_guard<std::mutex> lock(g_mtx);
        g_cmds.push(std::move(c));
    }
    return true;
}
bool available()
{
    return backend_available();
}
int window_count()
{
    std::lock_guard<std::mutex> lock(g_mtx);
    return static_cast<int>(g_windows.size());
}
void close_all()
{
    Cmd c;
    c.kind = Cmd::CLOSE_ALL;
    std::lock_guard<std::mutex> lock(g_mtx);
    g_cmds.push(std::move(c));
}
int loaded_count()
{
    return g_loaded.load();
}
}   // namespace gui
