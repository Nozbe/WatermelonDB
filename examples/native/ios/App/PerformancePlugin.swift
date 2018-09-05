import UIKit

@objc(PerformancePlugin)
final class PerformancePlugin: NSObject {
  @objc static let requiresMainQueueSetup: Bool = true
  @objc let methodQueue = DispatchQueue.main

  @objc(constantsToExport)
  var constantsToExport: NSDictionary {
    let appInitTimestamp = AppDelegate.shared.initTime.timeIntervalSince1970
    let appInitJSTimestamp = Int(appInitTimestamp * 1000)

    return [
      "appInitTimestamp": appInitJSTimestamp,
    ]
  }
}
