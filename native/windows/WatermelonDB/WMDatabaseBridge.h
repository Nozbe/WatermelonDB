#pragma once

#include "pch.h"

#include <functional>

#include "NativeModules.h"
#include <JSI/JsiApiContext.h>

#include "Database.h"

using namespace winrt::Microsoft::ReactNative;
using namespace watermelondb;

namespace winrt::WatermelonDB
{
  REACT_MODULE(WMDatabaseBridge, L"WMDatabaseBridge");
  struct WMDatabaseBridge
  {
    const std::string Name = "WMDatabaseBridge";

    ReactContext m_reactContext;
    REACT_INIT(Initialize)
    void Initialize(ReactContext const &reactContext) noexcept
    {
      m_reactContext = reactContext;
    }

    REACT_SYNC_METHOD(initializeJSI);
    bool initializeJSI() noexcept
    {
        assert(m_reactContext, "Expected ReactContext when initializing JSI");
        auto runtime = TryGetOrCreateContextRuntime(m_reactContext);
        assert(runtime, "Could not get jsi::Runtime from ReactContext");
        Database::install(runtime);
        return true;
    }
  };
}