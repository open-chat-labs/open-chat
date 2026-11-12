package com.ocplugin.app

// TODO replace this value with something more appropriate,e.g. OPEN_CHAT
const val LOG_TAG = "TEST_OC"

// Log tag for notification!
const val OC_TAG_NOT = "OC_TAG_NOT"

// Category that links dynamic ShortcutInfoCompat instances to the
// <share-target> declared in res/xml/shortcuts.xml. Shortcuts tagged
// with this category appear in the Direct Share row of the share sheet.
const val SHARE_TARGET_CATEGORY = "com.oclabs.openchat.category.SHARE_TARGET"

// All share-target shortcuts use this prefix on their ID, so we can
// distinguish them from other dynamic shortcuts (e.g. notification
// conversation shortcuts) when refreshing the set.
const val SHARE_SHORTCUT_ID_PREFIX = "share_"

// Intent extra that carries the OpenChat chat id when a share is delivered
// via a Direct Share shortcut. We use a custom key (rather than
// Intent.EXTRA_SHORTCUT_ID) because Android sets that to the shortcut's
// own id (e.g. "share_<chatId>"), and we want the bare chat id.
const val EXTRA_CHAT_ID = "com.oclabs.openchat.extra.CHAT_ID"

// Direct Share targets take ranks 0 up, in the order the web sends them (at most
// SHORTCUT_COUNT in app/src/stores/chatShortcuts.ts). A notification's conversation
// shortcut ranks after all of them: once the activity's shortcut limit is reached,
// pushDynamicShortcut drops the last-ranked one, so a burst of notifications evicts
// other notifications' shortcuts, never a share target, which the web pusher won't
// send again until its chat list changes.
const val NOTIFICATION_SHORTCUT_RANK = 4
