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

#默认连测试一起构建;分发时 -DSLANG_BUILD_TESTS=OFF 就只产出 vm.exe(也不会去拉 Catch2)
option(SLANG_BUILD_TESTS "构建测试(vm_test)" ON)

set(SLANG_VM_SOURCES lib/utils.cpp
        main.h
        lib/data.cpp
        lib/runtime.cpp
        lib/instruction.cpp)

#===== 单文件产物 =====
#要求:编译出来就是一个 exe,不依赖同目录的 libstdc++/libgcc/libwinpthread 等 DLL
function(slang_static_runtime target)
    if(MINGW)
        #-static 会把 libstdc++/libgcc/libwinpthread 全部链进 exe;
        #静态 msvcrt 还需要这两个符号别名,少了链接期直接报未定义
        target_link_options(${target} PRIVATE
                -static
                -static-libgcc
                -static-libstdc++
                -Wl,--defsym,__ms_vsnprintf=_vsnprintf
                -Wl,--defsym,__intrinsic_setjmpex=_setjmpex)
    elseif(MSVC)
        #MSVC 用 /MT(静态 CRT),否则会依赖 vcruntime140.dll / msvcp140.dll
        set_property(TARGET ${target} PROPERTY MSVC_RUNTIME_LIBRARY
                "MultiThreaded$<$<CONFIG:Debug>:Debug>")
    endif()
endfunction()

#链接完立刻扫导入表:出现系统 DLL 之外的依赖就让构建失败,而不是等到分发时才发现
function(slang_check_single_exe target)
    if(MINGW)
        find_program(SLANG_OBJDUMP objdump)
        if(SLANG_OBJDUMP)
            add_custom_command(TARGET ${target} POST_BUILD
                    COMMAND ${CMAKE_COMMAND}
                    -DOBJDUMP=${SLANG_OBJDUMP}
                    -DEXE=$<TARGET_FILE:${target}>
                    -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/check_single_exe.cmake
                    VERBATIM)
        else()
            message(WARNING "没找到 objdump,跳过单文件校验")
        endif()
    endif()
endfunction()

add_executable(vm main.cpp ${SLANG_VM_SOURCES})
#utils 的网络部分用了 winsock,缺这个库会在链接期报 __imp_WSAStartup 未定义
if(WIN32)
    target_link_libraries(vm PRIVATE ws2_32)
endif()
slang_static_runtime(vm)
slang_check_single_exe(vm)

if(NOT SLANG_BUILD_TESTS)
    return()
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
include(Catch)

#测试:unit 放 unit/<功能集>-<功能>.test.cpp,integration 放 integration/<功能集>.test.cpp
file(GLOB_RECURSE SLANG_VM_TEST_SOURCES CONFIGURE_DEPENDS
        test/unit/*.test.cpp
        test/integration/*.test.cpp
        test/system/*.test.cpp)
if(NOT SLANG_VM_TEST_SOURCES)
    message(FATAL_ERROR "没有找到任何测试文件")
endif()
add_executable(vm_test ${SLANG_VM_TEST_SOURCES} ${SLANG_VM_SOURCES})
target_link_libraries(vm_test PRIVATE Catch2::Catch2WithMain)
if(WIN32)
    target_link_libraries(vm_test PRIVATE ws2_32)
endif()
slang_static_runtime(vm_test)
slang_check_single_exe(vm_test)

#动了容易炸
#Windows 上 catch_discover_tests 会把中文用例名按 ACP 传给进程,过滤参数被转坏;
#那里退化成"整体跑一次",Linux/macOS 仍然逐条注册。
if(WIN32)
    add_test(NAME vm_test COMMAND vm_test)
else()
    catch_discover_tests(vm_test)
endif()

#单文件验证:PATH 里只留 System32(去掉 MinGW 目录)后仍然能跑,
#说明 exe 没有依赖工具链目录下的 libstdc++/libgcc/libwinpthread
if(WIN32)
    set(SLANG_SYSTEM_PATH "$ENV{SystemRoot}/System32;$ENV{SystemRoot}")
else()
    set(SLANG_SYSTEM_PATH "/usr/bin:/bin")
endif()
add_test(NAME vm_standalone
        COMMAND ${CMAKE_COMMAND} -E env "PATH=${SLANG_SYSTEM_PATH}"
        $<TARGET_FILE:vm_test> "[utils]")
add_test(NAME vm_exe_standalone
        COMMAND ${CMAKE_COMMAND} -E env "PATH=${SLANG_SYSTEM_PATH}" $<TARGET_FILE:vm>)
