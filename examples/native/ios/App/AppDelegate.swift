import UIKit

@UIApplicationMain
class AppDelegate: NSObject, UIApplicationDelegate {
  let initTime = Date()
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
    let jsLocation = RCTBundleURLProvider.sharedSettings()
      .jsBundleURL(forBundleRoot: "index", fallbackResource: nil)

    let rootView = RCTRootView(
      bundleURL: jsLocation,
      moduleName: "App",
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
