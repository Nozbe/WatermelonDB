import UIKit
import WatermelonDB

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, RCTBridgeDelegate {
    let initTime = Date()
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
        ) -> Bool {
        if NSClassFromString("XCTest") != nil {
            NSLog("%@", "WARN: WatermelonTester should be ran in Test mode, not ran directly to work in CI")
        }

        let bridge = RCTBridge(delegate: self, launchOptions: launchOptions)!
        let rootView = RCTRootView(bridge: bridge, moduleName: "watermelonTest", initialProperties: nil)

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

// MARK: - Bridge delegate

extension AppDelegate {
    func sourceURL(for bridge: RCTBridge!) -> URL! {
//        if DEBUG_USE_BUNDLED {
//            return RCTBundleURLProvider.sharedSettings()!.jsBundleURL(forFallbackResource: nil, fallbackExtension: nil)!
//        }

        guard let jsLocation = RCTBundleURLProvider.sharedSettings()
            .jsBundleURL(forBundleRoot: "src/index.integrationTests.native")
        else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                UIAlertController(title: "Could not find JS",
                                  message: "Could not get JS bundle URL. Most likely, the bundler server is dead. Remember to run yarn dev:native.\n\nIf you're running on device, you might also have connection issues - make sure you're connected to wifi and node is whitelisted in firewall settings.",
                                  preferredStyle: .alert)
                    .with { alert in
                        alert.addAction(UIAlertAction(title: "Okay...", style: .default) { _ in
                            alert.dismiss(animated: true, completion: nil)
                        })
                        if let rootVC = RCTKeyWindow()?.rootViewController {
                            if let presented = rootVC.presentedViewController {
                                presented.dismiss(animated: false) {
                                    rootVC.present(alert, animated: true)
                                }
                            } else {
                                rootVC.present(alert, animated: true)
                            }
                        }
                    }
            }
            
            return nil
        }
        
        return jsLocation
    }
}

extension NSObjectProtocol {
    @discardableResult
    public func with(_ fn: (Self) -> Void) -> Self {
        fn(self)
        return self
    }
}
