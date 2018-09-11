@testable import WatermelonTester
@testable import WatermelonDB
import XCTest
import Nimble

class BridgeTests: XCTestCase {
    func testBridge() {
        waitUntil(timeout: 100) { done in
            BridgeTestReporter.onFinished { result in
                switch result {
                case .success(let results):
                    consoleLog("Bridge tests completed!")
                    results.forEach { message in
                        consoleLog(message)
                    }
                case .failure(let errors):
                    errors.forEach { error in
                        fail(error)
                    }
                }

                done()
            }
        }
    }
}
