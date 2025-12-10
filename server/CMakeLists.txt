cmake_minimum_required(VERSION 3.15)
project(poker_server VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find libhv (assumes installed system-wide)
find_package(libhv REQUIRED)

add_executable(poker_server src/main.cpp)
target_link_libraries(poker_server libhv::libhv)

# Install target
install(TARGETS poker_server DESTINATION bin)