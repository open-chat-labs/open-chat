// swift-tools-version:5.9

import PackageDescription

// What the app and its Notification Service Extension share about pushes: reading the payload,
// the text and avatar a notification shows, and the APNs environment. Foundation only, so
// `swift test` runs it on a Mac.
let package = Package(
    name: "PushCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "PushCore", targets: ["PushCore"])
    ],
    dependencies: [
        // AppLanguage, the language chosen in the app
        .package(name: "ShareCore", path: "../ShareCore")
    ],
    targets: [
        .target(name: "PushCore", dependencies: [.product(name: "ShareCore", package: "ShareCore")]),
        .testTarget(name: "PushCoreTests", dependencies: ["PushCore"]),
    ]
)
