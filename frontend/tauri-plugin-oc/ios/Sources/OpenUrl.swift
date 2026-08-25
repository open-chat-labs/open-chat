import Foundation
import SafariServices
import Tauri
import UIKit

class OpenUrlArgs: Decodable {
    let url: String?
}

// Opens a URL outside the webview: an in-app Safari sheet for web links (the
// closest iOS equivalent of Android's Custom Tabs), and the system handler for
// everything else (mailto:, tel:, other apps' schemes).
enum OpenUrl {
    static func handle(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(OpenUrlArgs.self)

        guard let urlString = args.url, let url = URL(string: urlString) else {
            invoke.reject("INVALID_OR_INSECURE_URI")
            return
        }

        DispatchQueue.main.async {
            let scheme = url.scheme?.lowercased()
            if scheme == "http" || scheme == "https" {
                guard let presenter = topViewController() else {
                    invoke.reject("NO_PRESENTER")
                    return
                }
                presenter.present(SFSafariViewController(url: url), animated: true)
                invoke.resolve(["value": "ok"])
            } else {
                UIApplication.shared.open(url, options: [:]) { opened in
                    if opened {
                        invoke.resolve(["value": "ok"])
                    } else {
                        invoke.reject("NO_HANDLER_FOR_URL")
                    }
                }
            }
        }
    }

    private static func topViewController() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?.rootViewController

        var top = root
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
