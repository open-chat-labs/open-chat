// swift-tools-version:5.9

import PackageDescription

// The inbox the share extension leaves shared items in for the app. Foundation only, so
// `swift test` runs it on a Mac.
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
