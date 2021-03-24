import UIKit
import WatermelonDB

@UIApplicationMain
class AppDelegate: NSObject, UIApplicationDelegate {
    let initTime = Date()
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
        ) -> Bool {
        if NSClassFromString("XCTest") != nil {
            NSLog("%@", "WARN: WatermelonTester should be ran in Test mode, not ran directly to work in CI")
        }

        let jsLocation = RCTBundleURLProvider.sharedSettings()
            .jsBundleURL(forBundleRoot: "src/index.integrationTests.native", fallbackResource: nil)

        let rootView = RCTRootView(
            bundleURL: jsLocation,
            moduleName: "watermelonTest",
            initialProperties: nil,
            launchOptions: launchOptions
            )!

        let rootVC = UIViewController()
        rootVC.view = rootView

        let window = UIWindow()
        window.rootViewController = rootVC

        self.window = window
        window.makeKeyAndVisible()

        return true
    }

    // MARK: - Singleton

    private struct Singleton {
        static var shared: AppDelegate?
    }

    override init() {
        super.init()
        Singleton.shared = self
    }

    class var shared: AppDelegate! {
        return Singleton.shared
    }
}
