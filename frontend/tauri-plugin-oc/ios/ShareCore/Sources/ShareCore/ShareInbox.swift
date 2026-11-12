import Foundation

// The share extension copies what was shared into this inbox in the App Group container, one
// directory per share, and opens the app. The app moves each share into its own caches and
// hands it to the web layer as Android's `share-target` event.
//
// A share's directory is named `<milliseconds>-<uuid>`. The extension writes it as
// `<name>.partial` and renames it once its manifest is written, so the app never reads a share
// that is still being copied. The time in the name lets either side drop abandoned shares
// without reading file dates.
public struct ShareInbox {
    public static let appGroup = "group.com.oclabs.openchat"
    // A share the app never picked up, or the user never sent, goes after a day
    static let maxAge: TimeInterval = 24 * 60 * 60
    static let manifestName = "share.json"
    static let partial = ".partial"

    let root: URL

    public init(root: URL) {
        self.root = root
    }

    // The inbox both the extension and the app see, when the App Group is there
    public static func shared() -> ShareInbox? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
            .map { ShareInbox(root: $0.appendingPathComponent("share-inbox", isDirectory: true)) }
    }

    // The extension starts a share
    public func stage(now: Date = Date()) throws -> StagedShare {
        Self.prune(root, now: now)
        let name = "\(Int64(now.timeIntervalSince1970 * 1000))-\(UUID().uuidString)"
        let dir = root.appendingPathComponent(name + Self.partial, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return StagedShare(dir: dir, final: root.appendingPathComponent(name, isDirectory: true))
    }

    // The app takes every finished share out of the inbox, oldest first, moving its files into
    // `cache`. Each share is taken once.
    public func drain(into cache: URL, now: Date = Date()) -> [SharedItems] {
        let fm = FileManager.default
        Self.prune(root, now: now)
        Self.prune(cache, now: now)
        let names = ((try? fm.contentsOfDirectory(atPath: root.path)) ?? [])
            .filter { !$0.hasSuffix(Self.partial) }
            .sorted()

        return names.compactMap { name in
            let dir = root.appendingPathComponent(name, isDirectory: true)
            defer { try? fm.removeItem(at: dir) }
            guard
                let data = try? Data(contentsOf: dir.appendingPathComponent(Self.manifestName)),
                let manifest = try? JSONDecoder().decode(Manifest.self, from: data)
            else { return nil }

            let target = cache.appendingPathComponent(name, isDirectory: true)
            try? fm.createDirectory(at: target, withIntermediateDirectories: true)
            let files: [SharedFile] = manifest.files.compactMap { entry in
                let to = target.appendingPathComponent(entry.name)
                guard (try? fm.moveItem(at: dir.appendingPathComponent(entry.name), to: to)) != nil else {
                    return nil
                }
                let size = (try? fm.attributesOfItem(atPath: to.path)[.size] as? NSNumber)?.intValue ?? 0
                return SharedFile(path: to.path, name: entry.name, mimeType: entry.mimeType, size: size)
            }
            if files.isEmpty && manifest.text == nil { return nil }
            return SharedItems(text: manifest.text, files: files)
        }
    }

    // Drops shares older than a day, and anything in the directory that isn't one
    static func prune(_ dir: URL, now: Date) {
        let fm = FileManager.default
        let cutoff = Int64((now.timeIntervalSince1970 - maxAge) * 1000)
        for name in (try? fm.contentsOfDirectory(atPath: dir.path)) ?? [] {
            let stamp = Int64(name.prefix(while: \.isNumber))
            if stamp == nil || stamp! < cutoff {
                try? fm.removeItem(at: dir.appendingPathComponent(name))
            }
        }
    }
}

struct Manifest: Codable {
    struct Entry: Codable {
        let name: String
        let mimeType: String?
    }

    var text: String?
    var files: [Entry]
}

// One share the extension is copying into the inbox
public final class StagedShare {
    let dir: URL
    let final: URL
    private var manifest = Manifest(text: nil, files: [])

    init(dir: URL, final: URL) {
        self.dir = dir
        self.final = final
    }

    public var isEmpty: Bool {
        manifest.text == nil && manifest.files.isEmpty
    }

    // Shared text and links, joined by lines in the order they were added
    public func addText(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        manifest.text = manifest.text.map { "\($0)\n\(trimmed)" } ?? trimmed
    }

    // Copies a shared file in. The source is often only readable until the callback that
    // handed it over returns, so this copies straight away.
    public func addFile(copying source: URL, mimeType: String?) throws {
        let name = uniqueName(source.lastPathComponent.isEmpty ? "shared" : source.lastPathComponent)
        try FileManager.default.copyItem(at: source, to: dir.appendingPathComponent(name))
        manifest.files.append(.init(name: name, mimeType: mimeType))
    }

    // Makes the share visible to the app. A share with nothing in it is dropped.
    public func commit() throws {
        guard !isEmpty else { return discard() }
        try JSONEncoder().encode(manifest).write(to: dir.appendingPathComponent(ShareInbox.manifestName))
        try FileManager.default.moveItem(at: dir, to: final)
    }

    public func discard() {
        try? FileManager.default.removeItem(at: dir)
    }

    private func uniqueName(_ name: String) -> String {
        let taken = Set(manifest.files.map(\.name) + [ShareInbox.manifestName])
        guard taken.contains(name) else { return name }
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var n = 2
        while true {
            let candidate = ext.isEmpty ? "\(base)-\(n)" : "\(base)-\(n).\(ext)"
            if !taken.contains(candidate) { return candidate }
            n += 1
        }
    }
}

public struct SharedFile: Equatable {
    public let path: String
    public let name: String
    public let mimeType: String?
    public let size: Int
}

// A share as the web layer's `share-target` event carries it (share_target.ts), the shape the
// Android shell raises
public struct SharedItems: Equatable {
    public let text: String?
    public let files: [SharedFile]

    // Android passes on the share intent's type: one type for all the files, `image/*` for
    // mixed images, `*/*` for mixed kinds, `text/plain` for text alone
    public var mimeType: String {
        let types = Set(files.map { $0.mimeType ?? "application/octet-stream" })
        if types.isEmpty { return "text/plain" }
        if types.count == 1 { return types.first! }
        let kinds = Set(types.map { $0.split(separator: "/").first.map(String.init) ?? "" })
        return kinds.count == 1 ? "\(kinds.first!)/*" : "*/*"
    }

    // #10403 invariant A: the event's fields, with null where Android sends null. iOS has no
    // Direct Share shortcuts, so `shortcutId` is always null.
    public var event: [String: Any] {
        [
            "mimeType": mimeType,
            "text": orNull(text),
            "shortcutId": NSNull(),
            "files": files.map { file -> [String: Any] in
                [
                    "path": file.path,
                    "name": file.name,
                    "mimeType": orNull(file.mimeType),
                    "size": file.size,
                ]
            },
        ]
    }
}

private func orNull(_ value: String?) -> Any {
    value.map { $0 as Any } ?? NSNull()
}
