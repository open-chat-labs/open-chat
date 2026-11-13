// swift-tools-version:5.9

import PackageDescription

// What the app and its extensions share through the App Group: the inbox the share extension
// leaves shared items in for the app, and the language chosen in the app (AppLanguage).
// Foundation only, so `swift test` runs it on a Mac.
let package = Package(
    name: "ShareCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "ShareCore", targets: ["ShareCore"])
    ],
    targets: [
        .target(name: "ShareCore"),
        .testTarget(name: "ShareCoreTests", dependencies: ["ShareCore"]),
    ]
)
