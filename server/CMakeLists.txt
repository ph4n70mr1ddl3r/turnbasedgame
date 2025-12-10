cmake_minimum_required(VERSION 3.15)
project(poker_server VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find libhv (assumes installed system-wide)
# find_package(libhv REQUIRED)

# Main application - commented out until dependencies are available
# add_executable(poker_server src/main.cpp)
# target_link_libraries(poker_server libhv::libhv)

# Install target (commented out until server is implemented)
# install(TARGETS poker_server DESTINATION bin)

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