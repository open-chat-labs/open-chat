// swift-tools-version:5.9

import PackageDescription

// The rules for a native call that need no phone: when a call ends and how the shell tells the
// video bridge. Foundation only, so `swift test` runs it on a Mac.
let package = Package(
    name: "CallCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "CallCore", targets: ["CallCore"])
    ],
    targets: [
        .target(name: "CallCore"),
        .testTarget(name: "CallCoreTests", dependencies: ["CallCore"]),
    ]
)
