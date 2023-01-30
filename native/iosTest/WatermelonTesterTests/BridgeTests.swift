@testable import WatermelonTester
import XCTest

class BridgeTests: XCTestCase {
    func testBridge() {
        // TODO: Consider using Cavy native reporter https://github.com/Nozbe/WatermelonDB/pull/351/files
        let expectation = XCTestExpectation(description: "Cavy tests passed")

        BridgeTestReporter.onFinished { result in
            switch result {
            case .success(let results):
                print("Bridge tests completed!")
                results.forEach { message in
                    print(message)
                }
            case .failure(let errors):
                errors.forEach { error in
                    XCTFail(error)
                }
            }

            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 100)
    }
}
