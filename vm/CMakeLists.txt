cmake_minimum_required(VERSION 3.20)
project(slang LANGUAGES CXX)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
    message(FATAL_ERROR "禁止在源码目录内构建!请使用: cmake -B build")
endif()
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build type" FORCE)
endif()
find_package(Catch2 3 QUIET)
if(NOT Catch2_FOUND)
    include(FetchContent)
    FetchContent_Declare(
        Catch2
        GIT_REPOSITORY https://github.com/catchorg/Catch2.git
        GIT_TAG        v3.7.1
    )
    FetchContent_MakeAvailable(Catch2)
endif()

enable_testing()
#===== GUI(oper='GUI')后端检测:找不到对应依赖时 GUI 不可用,不影响其余功能 =====
#Windows:WebView2 SDK(优先 SLANG_WEBVIEW2_DIR,否则 NuGet 缓存 microsoft.web.webview2)
#Linux  :WebKitGTK(pkg-config webkit2gtk-4.1,回退 4.0)
#macOS  :Cocoa + WebKit(系统框架)
set(SLANG_WEBVIEW2_FOUND FALSE)
set(SLANG_GUI_LINK "")
if(WIN32)
    set(_wv2_root "$ENV{SLANG_WEBVIEW2_DIR}")
    if(NOT _wv2_root)
        file(GLOB _wv2_candidates
            "$ENV{USERPROFILE}/.nuget/packages/microsoft.web.webview2/*/build/native")
        list(SORT _wv2_candidates)
        list(REVERSE _wv2_candidates)
        list(GET _wv2_candidates 0 _wv2_root)
    endif()
    if(_wv2_root)
        set(_wv2_inc "${_wv2_root}/include")
        if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            set(_wv2_loader "${_wv2_root}/x64/WebView2Loader.dll")
        else()
            set(_wv2_loader "${_wv2_root}/x86/WebView2Loader.dll")
        endif()
        if(EXISTS "${_wv2_inc}/WebView2.h" AND EXISTS "${_wv2_loader}")
            set(SLANG_WEBVIEW2_FOUND TRUE)
            set(SLANG_WEBVIEW2_INCLUDE "${_wv2_inc}")
            set(SLANG_WEBVIEW2_LOADER "${_wv2_loader}")
            message(STATUS "WebView2 SDK found: ${_wv2_root}")
        endif()
    endif()
elseif(UNIX AND NOT APPLE)
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(WEBKIT2GTK IMPORTED_TARGET webkit2gtk-4.1)
        if(NOT WEBKIT2GTK_FOUND)
            pkg_check_modules(WEBKIT2GTK IMPORTED_TARGET webkit2gtk-4.0)
        endif()
        if(WEBKIT2GTK_FOUND)
            set(SLANG_WEBVIEW2_FOUND TRUE)
            set(SLANG_GUI_LINK PkgConfig::WEBKIT2GTK)
            message(STATUS "WebKitGTK found: ${WEBKIT2GTK_VERSION}")
        endif()
    endif()
elseif(APPLE)
    enable_language(OBJCXX)   #gui.cpp 在 macOS 以 Objective-C++ 编译
    find_library(COCOA_FW Cocoa)
    find_library(WEBKIT_FW WebKit)
    if(COCOA_FW AND WEBKIT_FW)
        set(SLANG_WEBVIEW2_FOUND TRUE)
        set(SLANG_GUI_LINK "${COCOA_FW};${WEBKIT_FW}")
        message(STATUS "macOS Cocoa+WebKit frameworks found")
    endif()
endif()
if(SLANG_WEBVIEW2_FOUND)
    add_definitions(-DSLANG_WEBVIEW2)
    if(WIN32)
        include_directories(${SLANG_WEBVIEW2_INCLUDE})
    endif()
    if(APPLE)
        #gui.cpp 内含 ObjC 代码,在 macOS 以 Objective-C++ 编译
        set_source_files_properties(gui.cpp PROPERTIES LANGUAGE OBJCXX)
    endif()
else()
    message(STATUS "GUI(oper='GUI') 依赖未找到:Windows 需 WebView2 SDK,Linux 需 libwebkit2gtk-4.1-dev,macOS 需系统框架")
endif()

set(SLANG_VM_SOURCES
        utils.h
        model.h
        runtime/runtime.h
        runtime/basic.cpp
        runtime/math.cpp
        runtime/io.cpp
        parser.cpp
        main.h
        gui.h
        gui.cpp
)
add_executable(vm main.cpp ${SLANG_VM_SOURCES})
if(WIN32)
    target_link_libraries(vm PRIVATE ws2_32 psapi)
endif()
if(SLANG_GUI_LINK)
    target_link_libraries(vm PRIVATE ${SLANG_GUI_LINK})
endif()
add_executable(vm_test
        test/unit/utils.test.cpp
        test/unit/model.test.cpp
        test/unit/basic.test.cpp
        test/unit/io.test.cpp
        test/unit/gui.test.cpp
        test/integration/parser.test.cpp
        test/integration/thread.test.cpp
        runtime/basic.cpp
        runtime/math.cpp
        runtime/io.cpp
        parser.cpp
        gui.cpp
)
target_include_directories(vm_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/runtime)
target_link_libraries(vm_test PRIVATE Catch2::Catch2WithMain)
if(WIN32)
    target_link_libraries(vm_test PRIVATE ws2_32 psapi)
endif()
if(SLANG_GUI_LINK)
    target_link_libraries(vm_test PRIVATE ${SLANG_GUI_LINK})
endif()
#WebView2Loader.dll 复制到可执行文件旁(运行时 LoadLibrary 按名加载)
if(SLANG_WEBVIEW2_FOUND AND WIN32)
    add_custom_command(TARGET vm POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${SLANG_WEBVIEW2_LOADER}" "$<TARGET_FILE_DIR:vm>")
    add_custom_command(TARGET vm_test POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${SLANG_WEBVIEW2_LOADER}" "$<TARGET_FILE_DIR:vm_test>")
endif()
include(Catch)
#动了容易炸
catch_discover_tests(vm_test)
if(MINGW)
    target_link_options(vm PRIVATE -static
            -Wl,--defsym,__ms_vsnprintf=_vsnprintf
            -Wl,--defsym,__intrinsic_setjmpex=_setjmpex)
    target_link_options(vm_test PRIVATE -static
            -Wl,--defsym,__ms_vsnprintf=_vsnprintf
            -Wl,--defsym,__intrinsic_setjmpex=_setjmpex)
endif()
