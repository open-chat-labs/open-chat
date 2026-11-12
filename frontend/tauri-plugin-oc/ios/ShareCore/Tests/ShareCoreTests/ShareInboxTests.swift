import XCTest

@testable import ShareCore

final class ShareInboxTests: XCTestCase {
    private var root: URL!
    private var inbox: ShareInbox!
    private var cache: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        inbox = ShareInbox(root: root.appendingPathComponent("inbox"))
        cache = root.appendingPathComponent("cache")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    private func source(_ name: String, _ contents: String) throws -> URL {
        let dir = root.appendingPathComponent("source-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        try contents.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    // #10403 invariant A: shared items reach the web layer in the same `share-target` event
    // shape Android raises (share_target.ts ShareTarget and SharedFile)
    func testInvariantASharedItemsReachTheWebLayerInTheAndroidEventShape() throws {
        let share = try inbox.stage()
        share.addText("look at these")
        try share.addFile(copying: try source("a.jpg", "one"), mimeType: "image/jpeg")
        try share.addFile(copying: try source("a.jpg", "two"), mimeType: "image/png")
        try share.commit()

        let shares = inbox.drain(into: cache)
        XCTAssertEqual(shares.count, 1)
        let event = shares[0].event
        XCTAssertEqual(Set(event.keys), ["mimeType", "text", "shortcutId", "files"])
        XCTAssertEqual(event["mimeType"] as? String, "image/*")
        XCTAssertEqual(event["text"] as? String, "look at these")
        XCTAssertTrue(event["shortcutId"] is NSNull)

        let files = try XCTUnwrap(event["files"] as? [[String: Any]])
        XCTAssertEqual(files.count, 2)
        for file in files {
            XCTAssertEqual(Set(file.keys), ["path", "name", "mimeType", "size"])
        }
        XCTAssertEqual(files.map { $0["name"] as? String }, ["a.jpg", "a-2.jpg"])
        // The web layer reads each file from its path, after the inbox is gone
        let path = try XCTUnwrap(files[1]["path"] as? String)
        XCTAssertEqual(try String(contentsOfFile: path, encoding: .utf8), "two")
        XCTAssertEqual(files[1]["size"] as? Int, 3)
        XCTAssertTrue(JSONSerialization.isValidJSONObject(event))
    }

    // #10403 invariant C: a share reaches the web layer once, and only once it's fully copied
    func testInvariantCAShareIsDeliveredOnceAndOnlyWhenFinished() throws {
        let copying = try inbox.stage()
        copying.addText("still copying")

        let done = try inbox.stage()
        done.addText("https://oc.app/community/abc")
        try done.commit()

        XCTAssertEqual(inbox.drain(into: cache).map(\.text), ["https://oc.app/community/abc"])
        XCTAssertEqual(inbox.drain(into: cache), [])

        try copying.commit()
        XCTAssertEqual(inbox.drain(into: cache).map(\.text), ["still copying"])
    }

    func testAFileOverTheSizeCapIsRefusedWithoutBeingCopied() throws {
        let big = try source("big.mov", "")
        let handle = try FileHandle(forWritingTo: big)
        // Sparse, so the test writes nothing
        try handle.truncate(atOffset: UInt64(ShareInbox.maxFileBytes + 1))
        try handle.close()

        let share = try inbox.stage()
        XCTAssertThrowsError(try share.addFile(copying: big, mimeType: "video/quicktime")) { error in
            XCTAssertEqual(error as? ShareError, .fileTooLarge)
        }
        XCTAssertTrue(share.isEmpty)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: share.dir.path), [])
    }
}
