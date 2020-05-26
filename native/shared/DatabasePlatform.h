#pragma once

#include <string>

namespace watermelondb {
namespace platform {

// Logs to console
void consoleLog(std::string message);

// Logs error to console
void consoleError(std::string message);

// Given a database name, returns a fully-qualified default database path
// e.g. /Users/foo.app/<name>.db
std::string resolveDatabasePath(std::string path);

// Removes database file located at `path`.
// Throws an exception if it's not possible to delete this file
void deleteDatabaseFile(std::string path, bool warnIfDoesNotExist);

// Calls function when device memory is getting low
void onMemoryAlert(std::function<void(void)> callback);

} // namespace platform
} // namespace watermelondb
