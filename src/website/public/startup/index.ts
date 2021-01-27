export default function() {
    setupBigIntSerialization();
    hideDropdownMenus();
}

function setupBigIntSerialization() {
    // Needed for serializing ChatId values
    (BigInt.prototype as any).toJSON = function() { return this.toString(); };
}

function hideDropdownMenus() {
    window.onclick = function (event: any) {
        if (event.target.matches('.hide-on-click-ignore, .hide-on-click-ignore *, .hide-on-click-outside, .hide-on-click-outside *'))
            return;

        const dropdowns = document.getElementsByClassName("hide-on-click-outside");
        for (let dropdown of dropdowns) {
            dropdown.classList.add('hide');
        }
    }
}
