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
include(Catch)
set(SLANG_VM_SOURCES utils.cpp
        main.h)
add_executable(vm main.cpp ${SLANG_VM_SOURCES})
add_executable(vm_test test/integration/parser.test.cpp)
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