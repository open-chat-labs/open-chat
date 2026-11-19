// The native tree's viewport. iOS zooms the page in when a field whose text is under 16px takes the
// focus (the library's fields are 13.5px) and leaves it zoomed, the layout wider than the screen.
// `maximum-scale=1` stops that, as the old mobile tree did (components_mobile's Head): Safari
// still lets people pinch to zoom (it ignores the limit for that since iOS 10), and the iOS app's
// WebView no longer zooms the page, as no native app does (the media viewer zooms by itself).
// Elsewhere it's left alone: Android's Chrome would stop people pinching to zoom, and the Android
// app stops it already (`touch-action`).

/** The viewport's content for the native tree, from the page's own (`base`). */
export function nativeViewport(base: string, ios: boolean): string {
    if (!ios || /maximum-scale/.test(base)) return base;
    return `${base}, maximum-scale=1`;
}
