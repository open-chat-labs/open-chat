// Links the font stylesheet of the App tree main.ts mounts. In a build with the new web UI the
// startup script in index.html has usually asked for it already, going by its own guess at the
// tree; when that guess was wrong, this still gets the mounted tree its fonts.
export function linkFonts(href: string): void {
    const linked = [...document.head.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]")];
    if (linked.some((link) => link.href === href)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}
