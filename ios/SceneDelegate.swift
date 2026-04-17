import UIKit
import CarPlay
import React

@available(iOS 13.0, *)
@objc
public class SceneDelegate: UIResponder, UIWindowSceneDelegate, CPTemplateApplicationSceneDelegate {
    
    public var window: UIWindow?
    public var interfaceController: CPInterfaceController?

  // MARK: - iPhone App Window
    public func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // 1. Create the main UIWindow
        let window = UIWindow(windowScene: windowScene)
        
        // 2. CRITICAL IPAD FIX: Make the window key and visible FIRST!
        // This forces the iPad to calculate its real dimensions before React Native boots.
        self.window = window
        window.makeKeyAndVisible()
        
        // 3. Grab the Expo React Native Factory from AppDelegate
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
           let factory = appDelegate.reactNativeFactory {
            
            // 4. Ask Expo to render the UI into our Window
            factory.startReactNative(
                withModuleName: "main",
                in: window,
                launchOptions: nil
            )
        }
    }

    // MARK: - CarPlay Window
    public func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        
        let item = CPListItem(text: "Astra Radio Live", detailText: "Loading...")
        let section = CPListSection(items: [item])
        let listTemplate = CPListTemplate(title: "Astra Radio", sections: [section])
        
        interfaceController.setRootTemplate(listTemplate, animated: true, completion: nil)
    }

    public func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        self.interfaceController = nil
    }
}
