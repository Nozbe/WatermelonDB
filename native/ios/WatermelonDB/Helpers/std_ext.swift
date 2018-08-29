import Foundation

// (Ugly hack) Set a function to customize logging behavior
public var _watermelonDBLoggingHook: (String) -> Void = { _ in }

func consoleLog(_ message: Any) {
    _watermelonDBLoggingHook("\(message)")
}

struct StringError: Error, CustomStringConvertible {
    let source: String
    let reason: String

    init(
        _ reason: String,
        function: StaticString = #function,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        self.source = "\(function):\(file):\(line)"
        self.reason = reason
    }

    var description: String {
        return "\(reason) (\(source))"
    }

    var _domain: String {
        return source
    }
}

extension String {
    func asError(function: StaticString = #function, file: StaticString = #file, line: UInt = #line) -> StringError {
        return StringError(self, function: function, file: file, line: line)
    }
}

var isTestRunning: Bool = NSClassFromString("XCTest") != nil

extension Array {
    subscript(safe index: Int) -> Element? {
        return index < count ? self[index] : nil
    }
}
