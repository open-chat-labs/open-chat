import Foundation

// Which APNs environment a build's tokens belong to. A development-signed build has an embedded
// provisioning profile saying `aps-environment` is `development`, and its tokens only work against
// the APNs sandbox. TestFlight and App Store builds have no embedded profile and use production.
public enum ApnsEnvironment {
    public static let sandboxPrefix = "sandbox:"

    // `profile` is the contents of embedded.mobileprovision, nil when the build has none
    public static func isSandbox(profile: Data?) -> Bool {
        guard let profile, let plist = embeddedPlist(profile),
            let entitlements = plist["Entitlements"] as? [String: Any]
        else { return false }
        return entitlements["aps-environment"] as? String == "development"
    }

    // The token as the backend stores it: hex, with the sandbox prefix when the pusher has to use
    // the sandbox host
    public static func tokenString(deviceToken: Data, sandbox: Bool) -> String {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        return sandbox ? sandboxPrefix + hex : hex
    }

    // The profile is a signed CMS message with the plist inside it in plain text
    private static func embeddedPlist(_ profile: Data) -> [String: Any]? {
        guard let start = profile.range(of: Data("<?xml".utf8)),
            let end = profile.range(of: Data("</plist>".utf8), in: start.lowerBound..<profile.endIndex)
        else { return nil }
        let xml = profile.subdata(in: start.lowerBound..<end.upperBound)
        return try? PropertyListSerialization.propertyList(from: xml, format: nil) as? [String: Any]
    }
}
