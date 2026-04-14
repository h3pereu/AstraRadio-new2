import CarPlay
import UIKit

@available(iOS 14.0, *)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

  private var interfaceController: CPInterfaceController?

  // Mirrors the station order and IDs from src/stations.ts
  private let stations: [(id: String, title: String)] = [
    ("astra-320", "320 kbps"),
    ("astra-128", "128 kbps"),
    ("astra-192", "192 kbps"),
  ]

  // MARK: - CPTemplateApplicationSceneDelegate

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    let listTemplate = buildListTemplate()
    interfaceController.setRootTemplate(listTemplate, animated: false, completion: nil)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
  }

  // MARK: - Private

  private func buildListTemplate() -> CPListTemplate {
    let activeId = CarPlayBridge.activeStationId

    let items: [CPListItem] = stations.map { station in
      let item = CPListItem(text: station.title, detailText: "Astra Radio")
      if station.id == activeId {
        item.accessoryImage = UIImage(systemName: "checkmark")
      }
      item.handler = { [weak self] _, completion in
        self?.handleStationSelected(id: station.id)
        completion()
      }
      return item
    }

    let section = CPListSection(items: items)
    return CPListTemplate(title: "Astra Radio", sections: [section])
  }

  private func handleStationSelected(id: String) {
    CarPlayBridge.shared?.switchStation(id: id)
    // Rebuild root template so the checkmark reflects the new selection when user navigates back
    interfaceController?.setRootTemplate(buildListTemplate(), animated: false, completion: nil)
    interfaceController?.pushTemplate(
      CPNowPlayingTemplate.shared,
      animated: true,
      completion: nil
    )
  }
}
