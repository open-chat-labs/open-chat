import Foundation

// The shell's own text (notifications, the missed call, the share sheet, the call screen) is part of
// OpenChat's UI, so it is in the language chosen in the app, not the phone's. The web layer sends it
// with `set_app_language` at every start and on every change, and the app keeps it in the App Group
// so the extensions read it too. Until it has, or for a language the shell has no translations for,
// the text follows the phone's language.
public enum AppLanguage {
    // The call screen (NativeCallScreen.swift) reads this too, since the app target can't import
    // ShareCore
    static let key = "appLanguage"

    // The app's language codes (app/src/i18n) and the .lproj each one reads. nativeStrings.spec.ts
    // checks every app language is here and has its folder in every target.
    static let lprojs: [String: String] = [
        "ar": "ar",
        "cn": "zh-Hans",
        "de": "de",
        "en": "en",
        "es": "es",
        "fa": "fa",
        "fr": "fr",
        "hi": "hi",
        "it": "it",
        "iw": "he",
        "jp": "ja",
        "pl": "pl",
        "ru": "ru",
        "uk": "uk",
        "vi": "vi",
    ]

    public static var shared: UserDefaults? { UserDefaults(suiteName: ShareInbox.appGroup) }

    public static func save(appCode: String?, to defaults: UserDefaults? = shared) {
        if let lproj = appCode.flatMap({ lprojs[$0] }) {
            defaults?.set(lproj, forKey: key)
        } else {
            defaults?.removeObject(forKey: key)
        }
    }

    // The app's language's .lproj in `main`, or `main` itself, which picks the phone's language
    public static func bundle(in main: Bundle = .main, defaults: UserDefaults? = shared) -> Bundle {
        guard
            let lproj = defaults?.string(forKey: key),
            let path = main.path(forResource: lproj, ofType: "lproj"),
            let bundle = Bundle(path: path)
        else { return main }
        return bundle
    }

    // What every lookup of the shell's own text goes through. The keys are the English text.
    public static func localized(_ key: String, in main: Bundle = .main, defaults: UserDefaults? = shared) -> String {
        bundle(in: main, defaults: defaults).localizedString(forKey: key, value: nil, table: nil)
    }
}
