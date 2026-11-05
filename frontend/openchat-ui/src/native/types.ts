// Types the native shell kit's components take (exported from src/native/index.ts).

/** A tab of the native tab bar. */
export type NativeTab = {
  id: string;
  /** Resource key (or literal text): the tab's accessible name (the bar shows icons only). */
  label: string;
  /** An icons.js name. */
  icon: string;
  /** Unread count, shown as a pill (Chats). 0 or none hides it. */
  count?: number;
  /** An accent dot (Activity). */
  dot?: boolean;
  /** The user's photo, in place of the icon (You), when they have one. */
  avatarUrl?: string;
};

/** A trailing icon button of a native page header. */
export type NativeHeaderAction = {
  /** An icons.js name. */
  icon: string;
  /** Resource key (or literal text): the button's accessible name. */
  label: string;
  /** Gets the button, to anchor a menu to. */
  onClick: (anchor: HTMLElement) => void;
};
