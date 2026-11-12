import ShareCore
import UIKit
import UniformTypeIdentifiers

// OpenChat in the share sheet (#10403). Copies what was shared into the App Group inbox and
// opens the app, which shows its chat picker with the share, like Android's share target.
// Prior art: big-chat's ShareViewController (git c8fa86931^).
final class ShareViewController: UIViewController {
    // Opens the app without navigating anywhere; the web layer ignores this link
    private static let wakeUrl = URL(string: "openchat://oc.app/share-inbox")!
    // A source app whose items never load mustn't leave the sheet spinning
    private static let watchdog: TimeInterval = 20

    private let spinner = UIActivityIndicatorView(style: .large)
    private var started = false
    private var resolved = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.watchdog) { [weak self] in
            guard let self, !self.resolved else { return }
            self.resolved = true
            self.showResult(
                symbol: "exclamationmark.triangle.fill", tint: .systemOrange,
                title: NSLocalizedString("Couldn't prepare the share", comment: ""),
                subtitle: NSLocalizedString("Please try again", comment: ""))
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true

        guard let inbox = ShareInbox.shared(), let share = try? inbox.stage() else {
            NSLog("[Share] the App Group inbox is unavailable")
            return finish()
        }
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let providers = items.flatMap { $0.attachments ?? [] }
        if let comment = items.first?.attributedContentText?.string {
            share.addText(comment)
        }

        // One attachment at a time, off the main thread, which keeps the extension's memory down
        // when several videos are shared
        DispatchQueue.global(qos: .userInitiated).async {
            for provider in providers {
                self.load(provider) { file, text in
                    if let file {
                        do {
                            try share.addFile(copying: file.url, mimeType: file.mimeType)
                        } catch {
                            NSLog("[Share] couldn't copy a shared file: %@", error.localizedDescription)
                        }
                    }
                    if let text { share.addText(text) }
                }
            }
            DispatchQueue.main.async { self.handOver(share) }
        }
    }

    private func handOver(_ share: StagedShare) {
        guard !resolved else { return share.discard() }
        resolved = true
        do {
            if share.isEmpty { return finish() }
            try share.commit()
        } catch {
            NSLog("[Share] couldn't hand the share over: %@", error.localizedDescription)
            share.discard()
            return finish()
        }
        openApp()
    }

    // Reads one attachment, returning once `received` has run. A file is handed over while it
    // can still be read, which for most providers is only until the callback returns, so
    // `received` copies it at once.
    private func load(_ provider: NSItemProvider, received: @escaping ((url: URL, mimeType: String?)?, String?) -> Void) {
        let done = DispatchSemaphore(value: 0)
        func finished() { done.signal() }

        if let type = fileType(of: provider) {
            provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
                let mimeType = url.flatMap { UTType(filenameExtension: $0.pathExtension)?.preferredMIMEType }
                    ?? UTType(type)?.preferredMIMEType
                received(url.map { ($0, mimeType) }, nil)
                finished()
            }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, _ in
                let url: URL? = switch item {
                case let url as URL: url
                case let data as Data: URL(dataRepresentation: data, relativeTo: nil)
                default: nil
                }
                // Files from outside our sandbox, such as the Files app, come security scoped
                let scoped = url?.startAccessingSecurityScopedResource() ?? false
                defer { if scoped { url?.stopAccessingSecurityScopedResource() } }
                received(url.map { ($0, UTType(filenameExtension: $0.pathExtension)?.preferredMIMEType) }, nil)
                finished()
            }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                received(nil, (item as? URL)?.absoluteString)
                finished()
            }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                let text: String? = switch item {
                case let string as String: string
                case let data as Data: String(data: data, encoding: .utf8)
                default: nil
                }
                received(nil, text)
                finished()
            }
        } else {
            finished()
        }
        done.wait()
    }

    // The most specific type a file can be made from. Links and inline text aren't files, and a
    // `public.file-url` is read through its URL instead.
    private func fileType(of provider: NSItemProvider) -> String? {
        provider.registeredTypeIdentifiers.first { id in
            guard let type = UTType(id) else { return false }
            return !type.conforms(to: .url) && !type.conforms(to: .plainText) && type.conforms(to: .data)
        }
    }

    // Extensions can't use UIApplication.shared, so the app is opened through the responder
    // chain. iOS 18 refuses the deprecated openURL: from an extension, hence the IMP cast to
    // the selector that takes options.
    private func openApp() {
        var responder: UIResponder? = self
        while let current = responder, !(current is UIApplication) { responder = current.next }
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        guard let application = responder as? UIApplication, application.responds(to: selector) else {
            return showOpenTheApp()
        }
        typealias Open = @convention(c) (
            UIApplication, Selector, NSURL, NSDictionary, (@convention(block) (Bool) -> Void)?
        ) -> Void
        let open = unsafeBitCast(application.method(for: selector), to: Open.self)
        let handler: @convention(block) (Bool) -> Void = { opened in
            DispatchQueue.main.async { [weak self] in
                if opened {
                    // Lets the switch to the app start before the sheet goes
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { self?.finish() }
                } else {
                    self?.showOpenTheApp()
                }
            }
        }
        open(application, selector, Self.wakeUrl as NSURL, [:] as NSDictionary, handler)
    }

    // The share waits in the inbox, and the app picks it up the next time it opens
    private func showOpenTheApp() {
        showResult(
            symbol: "checkmark.circle.fill", tint: .systemGreen,
            title: NSLocalizedString("Shared to OpenChat", comment: ""),
            subtitle: NSLocalizedString("Open OpenChat to send it", comment: ""))
    }

    private func showResult(symbol: String, tint: UIColor, title: String, subtitle: String) {
        spinner.removeFromSuperview()

        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.tintColor = tint
        icon.contentMode = .scaleAspectFit

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        let subtitleLabel = UILabel()
        subtitleLabel.text = subtitle
        subtitleLabel.font = .preferredFont(forTextStyle: .subheadline)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0

        let done = UIButton(type: .system)
        done.setTitle(NSLocalizedString("Done", comment: ""), for: .normal)
        done.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        done.addAction(UIAction { [weak self] _ in self?.finish() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [icon, titleLabel, subtitleLabel, done])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.setCustomSpacing(24, after: subtitleLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 56),
            icon.heightAnchor.constraint(equalToConstant: 56),
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32),
        ])
    }

    private func finish() {
        resolved = true
        extensionContext?.completeRequest(returningItems: nil)
    }
}
