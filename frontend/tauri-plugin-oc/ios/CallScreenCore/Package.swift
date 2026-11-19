// swift-tools-version:5.9

import PackageDescription

// The iOS call screen's rules that need no phone (#10529): how the stage lays its people out,
// which controls show, when they hide and where the user's own camera settles. The screen is
// in the app target, which links Daily; this is linked there alone. Foundation only, so
// `swift test` runs it on a Mac.
let package = Package(
    name: "CallScreenCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "CallScreenCore", targets: ["CallScreenCore"])
    ],
    targets: [
        .target(name: "CallScreenCore"),
        .testTarget(name: "CallScreenCoreTests", dependencies: ["CallScreenCore"]),
    ]
)
