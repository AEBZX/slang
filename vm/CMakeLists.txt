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
add_executable(vm main.cpp
        utils.h
        model.h
        runtime/runtime.h
        runtime/basic.cpp
        runtime/math.cpp
        runtime/io.cpp
        parser.cpp
        main.h
)
if(WIN32)
    target_link_libraries(vm PRIVATE ws2_32 psapi)
endif()
add_executable(vm_test
        test/unit/utils.test.cpp
        test/unit/model.test.cpp
        test/unit/basic.test.cpp
        test/unit/io.test.cpp
        test/integration/parser.test.cpp
        runtime/basic.cpp
        runtime/math.cpp
        runtime/io.cpp
        parser.cpp
)
target_include_directories(vm_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/runtime)
target_link_libraries(vm_test PRIVATE Catch2::Catch2WithMain)
if(WIN32)
    target_link_libraries(vm_test PRIVATE ws2_32 psapi)
endif()

# ctest 自动枚举每个 TEST_CASE(类似 vitest 的每个 it)
include(Catch)
catch_discover_tests(vm_test)

# MinGW 运行时 DLL 拷到 exe 同目录,避免 0xc0000135(DLL 找不到)
# Windows 加载器优先在 exe 所在目录查找,ctest/双击运行无需手动加 PATH
# 注意:不能用 ${CMAKE_CXX_COMPILER}/../bin(c++.exe 是文件,拼出非法路径),
# DLL 与编译器同目录,用 get_filename_component 取编译器所在目录
if(WIN32 AND MINGW)
    get_filename_component(MINGW_RT_DIR "${CMAKE_CXX_COMPILER}" DIRECTORY)
    set(MINGW_RT_DLLS libgcc_s_seh-1.dll libstdc++-6.dll libwinpthread-1.dll)
    foreach(tgt vm vm_test)
        foreach(dll IN LISTS MINGW_RT_DLLS)
            add_custom_command(TARGET ${tgt} POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                        "${MINGW_RT_DIR}/${dll}"
                        "$<TARGET_FILE_DIR:${tgt}>/${dll}"
                COMMENT "Copy MinGW runtime ${dll} next to ${tgt}"
            )
        endforeach()
    endforeach()
endif()
