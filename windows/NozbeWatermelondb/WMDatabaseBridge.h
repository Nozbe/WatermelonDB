#pragma once

#include "pch.h"

#include <functional>

#include "NativeModules.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::NozbeWatermelondb
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

    REACT_SYNC_METHOD(add, L"add");
    double add(double a, double b) noexcept
    {
      double result = a + b;
      return result;
    }
  };
}