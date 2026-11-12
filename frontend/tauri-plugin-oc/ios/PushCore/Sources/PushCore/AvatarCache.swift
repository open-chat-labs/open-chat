import Foundation

// The avatars the Notification Service Extension has fetched, kept on disk so each push in a busy
// chat doesn't fetch them again. An entry is keyed by the avatar's URL, which ends in its blob id;
// a new avatar gets a new id, so an entry never goes stale. The least recently used go first.
public final class AvatarCache: @unchecked Sendable {
    public static let maxEntries = 64
    // Avatars are small, and the extension has little memory to share between pushes
    public static let maxBytes = 2 * 1024 * 1024

    private let directory: URL
    private let maxEntries: Int
    private let configuration: URLSessionConfiguration

    public init(directory: URL, maxEntries: Int = maxEntries, configuration: URLSessionConfiguration = .ephemeral) {
        self.directory = directory
        self.maxEntries = maxEntries
        self.configuration = configuration
    }

    // Nil when the avatar can't be fetched or is bigger than `maxBytes`
    public func avatar(at url: URL) async -> Data? {
        let fm = FileManager.default
        let file = directory.appendingPathComponent(Self.key(url))
        if let cached = try? Data(contentsOf: file) {
            try? fm.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
            return cached
        }

        guard let data = await CappedDownload.data(from: url, cap: Self.maxBytes, configuration: configuration)
        else { return nil }
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: file, options: .atomic)
        prune()
        return data
    }

    private static func key(_ url: URL) -> String {
        String(url.absoluteString.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "." ? $0 : "_" })
    }

    private func prune() {
        let date = URLResourceKey.contentModificationDateKey
        guard
            let entries = try? FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: [date], options: [.skipsHiddenFiles]),
            entries.count > maxEntries
        else { return }
        func modified(_ url: URL) -> Date {
            (try? url.resourceValues(forKeys: [date]).contentModificationDate) ?? .distantPast
        }
        for url in entries.sorted(by: { modified($0) < modified($1) }).prefix(entries.count - maxEntries) {
            try? FileManager.default.removeItem(at: url)
        }
    }
}

// A download that gives up once the body passes `cap`, without holding more than that in memory.
// A plain data task would buffer the whole body before anything could check its size.
enum CappedDownload {
    static func data(from url: URL, cap: Int, configuration: URLSessionConfiguration) async -> Data? {
        await withCheckedContinuation { continuation in
            let delegate = Delegate(cap: cap) { continuation.resume(returning: $0) }
            URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
                .dataTask(with: url).resume()
        }
    }

    private final class Delegate: NSObject, URLSessionDataDelegate {
        private let cap: Int
        private let completion: (Data?) -> Void
        private var received = Data()
        private var refused = false

        init(cap: Int, completion: @escaping (Data?) -> Void) {
            self.cap = cap
            self.completion = completion
        }

        func urlSession(
            _ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
            completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
        ) {
            // An unknown length (-1) gets through here, and is held to the cap as it arrives
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                http.expectedContentLength <= Int64(cap)
            else {
                refused = true
                return completionHandler(.cancel)
            }
            completionHandler(.allow)
        }

        func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
            guard !refused else { return }
            received.append(data)
            if received.count > cap {
                refused = true
                received = Data()
                dataTask.cancel()
            }
        }

        // Called once per task, cancelled or not. A body that finishes arriving after the cancel
        // was asked for still counts as refused.
        func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
            completion(error == nil && !refused ? received : nil)
            session.finishTasksAndInvalidate()
        }
    }
}
