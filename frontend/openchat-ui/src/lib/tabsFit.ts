// Whether a SegmentedTabs bar holds every tab's label on one line at its full width. When it doesn't, the bar is
// tight: its tabs shrink and their labels end in an ellipsis, rather than spilling out of the bar.

/** A tab's parts (label, count pill, dot) at their full widths, and the gap between them. */
export type TabParts = { widths: number[]; gap: number };

/** The bar: its width (padding included), its padding at both ends, and the gap between tabs. */
export type TabsBar = { width: number; padding: number; gap: number };

/** The width the tabs need side by side, each as wide as its parts. */
export function tabsNeed(bar: Omit<TabsBar, 'width'>, tabs: TabParts[]): number {
  const between = (count: number, gap: number) => gap * Math.max(0, count - 1);
  const tabWidths = tabs.map((tab) => tab.widths.reduce((sum, w) => sum + w, 0) + between(tab.widths.length, tab.gap));
  return bar.padding + between(tabs.length, bar.gap) + tabWidths.reduce((sum, w) => sum + w, 0);
}

/** Whether every tab fits the bar at its full width. */
export function tabsFit(bar: TabsBar, tabs: TabParts[]): boolean {
  return tabsNeed(bar, tabs) <= bar.width;
}
