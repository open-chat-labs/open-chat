import XCTest

@testable import ShareCore

// The shell's own text follows the language chosen in the app (AppLanguage.swift), and the phone's
// until there is one.
final class AppLanguageTests: XCTestCase {
    private var root: URL!
    private var main: Bundle!
    private var suite: String!
    private var defaults: UserDefaults!

    // A bundle with English and German tables, as each target has
    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        for (lproj, photo) in [("en", "Photo"), ("de", "Foto"), ("zh-Hans", "照片")] {
            let dir = root.appendingPathComponent("\(lproj).lproj")
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try "\"Photo\" = \"\(photo)\";".write(
                to: dir.appendingPathComponent("Localizable.strings"), atomically: true, encoding: .utf8)
        }
        main = Bundle(path: root.path)
        suite = "AppLanguageTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
    }

    override func tearDownWithError() throws {
        defaults.removePersistentDomain(forName: suite)
        try? FileManager.default.removeItem(at: root)
    }

    private func photo() -> String { AppLanguage.localized("Photo", in: main, defaults: defaults) }

    // Invariant 1: with a saved app language, the text is in it, not the phone's
    func testInvariant1TheTextIsInTheSavedAppLanguage() {
        AppLanguage.save(appCode: "de", to: defaults)
        XCTAssertEqual(photo(), "Foto")

        // an app code that isn't the platform's
        AppLanguage.save(appCode: "cn", to: defaults)
        XCTAssertEqual(photo(), "照片")
    }

    // Invariant 2: with nothing saved, or an unknown code, the bundle's own lookup picks the
    // phone's language
    func testInvariant2WithNothingSavedTheTextFollowsThePhone() {
        XCTAssertTrue(AppLanguage.bundle(in: main, defaults: defaults) === main)
    }

    func testInvariant2AnUnknownCodeClearsTheSavedLanguage() {
        AppLanguage.save(appCode: "de", to: defaults)
        AppLanguage.save(appCode: "sv", to: defaults)
        XCTAssertTrue(AppLanguage.bundle(in: main, defaults: defaults) === main)
    }
}
