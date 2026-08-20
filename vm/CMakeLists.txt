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
        test/integration/thread.test.cpp
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
include(Catch)
#动了容易炸
catch_discover_tests(vm_test)
target_link_options(vm PRIVATE -static
        -Wl,--defsym,__ms_vsnprintf=_vsnprintf
        -Wl,--defsym,__intrinsic_setjmpex=_setjmpex)
target_link_options(vm_test PRIVATE -static
        -Wl,--defsym,__ms_vsnprintf=_vsnprintf
        -Wl,--defsym,__intrinsic_setjmpex=_setjmpex)
