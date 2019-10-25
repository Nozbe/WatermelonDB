#pragma once

#import <jsi/jsi.h>

using namespace facebook;

namespace watermelondb {

class Database : public jsi::HostObject {

private:
    void batch(jsi::Runtime &runtime, jsi::Array &operations);
};

} // namespace watermelondb
