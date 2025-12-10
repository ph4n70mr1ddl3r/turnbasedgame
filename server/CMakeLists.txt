cmake_minimum_required(VERSION 3.15)
project(poker_server VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Fetch libhv from GitHub
include(FetchContent)
# Fetch libhv
FetchContent_Declare(
  libhv
  GIT_REPOSITORY https://github.com/ithewei/libhv.git
  GIT_TAG v1.3.0
)
# Fetch nlohmann/json
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.2
)
FetchContent_MakeAvailable(libhv nlohmann_json)

# Find libhv (assumes installed system-wide)
find_package(libhv REQUIRED)

# Main application
add_executable(poker_server src/main.cpp)
target_link_libraries(poker_server libhv::libhv nlohmann_json::nlohmann_json)

# Install target
install(TARGETS poker_server DESTINATION bin)

# Testing configuration
option(BUILD_TESTS "Build tests" ON)

if(BUILD_TESTS)
  # Download and setup Google Test
  include(FetchContent)
  FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.tar.gz
  )
  # For Windows: Prevent overriding the parent project's compiler/linker settings
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)

  # Create test executable
  add_executable(poker_server_tests
    tests/websocket_server.test.cpp
    # tests/poker_logic.test.cpp # File doesn't exist yet
  )
  target_link_libraries(poker_server_tests
    GTest::gtest_main
    # libhv::libhv  # Not needed for current tests
  )

  # Include directories
  target_include_directories(poker_server_tests PRIVATE src)

  # Discover tests
  include(GoogleTest)
  gtest_discover_tests(poker_server_tests)

  # Add test run command
  add_custom_command(TARGET poker_server_tests POST_BUILD
    COMMAND $<TARGET_FILE:poker_server_tests>
    COMMENT "Running unit tests"
  )
endif()