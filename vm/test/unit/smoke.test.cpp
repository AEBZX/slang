#include <catch2/catch_test_macros.hpp>
#include <algorithm>
#include <string>
#include <vector>

TEST_CASE("catch2 框架可用", "[env]") {
    REQUIRE(1 + 1 == 2);

    SECTION("CHECK 失败不中断") {
        CHECK(true);
    }

    SECTION("字符串比较") {
        CHECK(std::string("slang") == std::string("slang"));
    }
}

TEST_CASE("vector 基本操作", "[env]") {
    std::vector<int> v{3, 1, 2};
    std::sort(v.begin(), v.end());
    REQUIRE(v.size() == 3);
    CHECK(v[0] == 1);
    CHECK(v[1] == 2);
    CHECK(v[2] == 3);
}
