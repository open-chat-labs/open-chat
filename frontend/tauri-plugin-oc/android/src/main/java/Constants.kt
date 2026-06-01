package com.ocplugin.app

// TODO replace this value with something more appropriate,e.g. OPEN_CHAT
const val LOG_TAG = "TEST_OC"

// Log tag for notification!
const val OC_TAG_NOT = "OC_TAG_NOT"

// Category that links dynamic ShortcutInfoCompat instances to the
// <share-target> declared in res/xml/shortcuts.xml. Shortcuts tagged
// with this category appear in the Direct Share row of the share sheet.
const val SHARE_TARGET_CATEGORY = "com.oc.app.category.SHARE_TARGET"

// All share-target shortcuts use this prefix on their ID, so we can
// distinguish them from other dynamic shortcuts (e.g. notification
// conversation shortcuts) when refreshing the set.
const val SHARE_SHORTCUT_ID_PREFIX = "share_"