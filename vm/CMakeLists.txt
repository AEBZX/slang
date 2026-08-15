cmake_minimum_required(VERSION 3.20)
project(slang LANGUAGES CXX)
# 构建产物统一放独立目录,禁止源码内构建(cmake . 会污染源码树)
# 用法: cmake -B build [-G "生成器"] && cmake --build build
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
    message(FATAL_ERROR "禁止在源码目录内构建!请使用: cmake -B build")
endif()

set(CMAKE_CXX_STANDARD 17)
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

# ===== VM 主程序 =====
# 目标名 vm → 产物 vm.exe(与 compiler CLI 配置里的 vm:'vm.exe' 对齐)
# 后续 VM 源码加进此目标,或收进 vm_core 库再链接
add_executable(vm main.cpp
        pool/pool.h
        utils.h
        model.h
)

# ===== VM 测试可执行文件 =====
# 后续写 VM 代码时:在此加 add_library(vm_core ...) 并把源文件收进 core 库,
# 测试文件里 include 对应头文件、link vm_core 即可
add_executable(vm_test
    test/unit/smoke.test.cpp
)
target_link_libraries(vm_test PRIVATE Catch2::Catch2WithMain)

# ctest 自动枚举每个 TEST_CASE(类似 vitest 的每个 it)
include(Catch)
catch_discover_tests(vm_test)
