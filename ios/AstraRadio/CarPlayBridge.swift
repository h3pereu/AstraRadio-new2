import Foundation
import React

@objc(CarPlayBridge)
class CarPlayBridge: RCTEventEmitter {

  static var shared: CarPlayBridge?

  // Tracks the last station selected via CarPlay, or the app default.
  // Used by CarPlaySceneDelegate to show a checkmark on initial connect.
  static var activeStationId: String = "astra-128"

  override init() {
    super.init()
    CarPlayBridge.shared = self
  }

  override func supportedEvents() -> [String]! {
    return ["carplay_switch_station"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  /// Called by CarPlaySceneDelegate when the user picks a stream.
  func switchStation(id: String) {
    CarPlayBridge.activeStationId = id
    sendEvent(withName: "carplay_switch_station", body: ["id": id])
  }
}
