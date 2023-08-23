#pragma once

#include <functional>
#include <iostream>
#include <string>
#include "Database.h"
#include <AtlBase.h>
#include <atlconv.h>
#include <winrt/Windows.Storage.h>

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    std::string fullMessage = "WatermelonDB (info): " + message + "\n";
    OutputDebugStringA(fullMessage.c_str());
}

void consoleError(std::string message) {
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

        // Need to set temporary folder in WinRT
        // https://www.sqlite.org/c3ref/temp_directory.html
        auto tempPath = winrt::Windows::Storage::ApplicationData::Current().TemporaryFolder().Path();
        auto tempPathStr = winrt::to_string(tempPath);
        sqlite3_temp_directory = sqlite3_mprintf("%s", tempPathStr.c_str()); 

        if (sqlite3_initialize() != SQLITE_OK) {
            consoleError("Failed to initialize sqlite - this probably means sqlite was already initialized");
        }
    });
}

std::string resolveDatabasePath(std::string path) {
    auto const localAppDataPath = winrt::Windows::Storage::ApplicationData::Current().LocalFolder().Path();
    auto fullPath = winrt::to_string(localAppDataPath) + "\\" + path;
    return fullPath;
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
