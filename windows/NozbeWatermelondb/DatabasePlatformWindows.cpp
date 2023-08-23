#pragma once

#include <functional>
#include <iostream>
#include <string>
#include "Database.h"

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    // FIXME: Broken logging
    std::string fullMessage = "WatermelonDB (info): " + message + "\n";
    OutputDebugStringA(fullMessage.c_str());
}

void consoleError(std::string message) {
    // FIXME: Broken logging
    std::string fullMessage = "WatermelonDB (error): " + message + "\n";
    OutputDebugStringA(fullMessage.c_str());
}

std::once_flag sqliteInitialization;

void initializeSqlite() {
    std::call_once(sqliteInitialization, []() {
        // Enable file URI syntax https://www.sqlite.org/uri.html (e.g. ?mode=memory&cache=shared)
        if (sqlite3_config(SQLITE_CONFIG_URI, 1) != SQLITE_OK) {
            consoleError("Failed to configure SQLite to support file URI syntax - shared cache will not work");
        }

        if (sqlite3_initialize() != SQLITE_OK) {
            consoleError("Failed to initialize sqlite - this probably means sqlite was already initialized");
        }
    });
}

std::string resolveDatabasePath(std::string path) {
    // TODO: Unimplemented
    return "";
}

void deleteDatabaseFile(std::string path, bool warnIfDoesNotExist) {
    // TODO: Unimplemented
}

void onMemoryAlert(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

std::string_view getSyncJson(int id) {
    return "";
}

void deleteSyncJson(int id) {
    // TODO: Unimplemented
}

void onDestroy(std::function<void(void)> callback) {
    // TODO: Unimplemented
}

} // namespace platform
} // namespace watermelondb
