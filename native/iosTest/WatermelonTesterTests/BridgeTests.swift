import XCTest

class BridgeTests: XCTestCase {
    func testBridge() {
        let expectation = XCTestExpectation(description: "Cavy tests passed")

        CavyNativeReporter.onFinish { report in
            NSLog("%@", report)

            let errorCount = report["errorCount"] as? Int ?? 0
            if errorCount > 0 {
                XCTFail("Cavy tests had one or more errors")
            }
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 100)
    }
}
