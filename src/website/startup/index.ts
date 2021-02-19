import tagManagerHeaderTag from "../analytics/ga/tagManagerHeaderScript.html";
import tagManagerBodyTag from "../analytics/ga/tagManagerBodyScript.html";

export default function() {
    insertGoogleTagManagerScripts();
    setupBigIntSerialization();
    hideDropdownMenus();
}

function insertGoogleTagManagerScripts() {
    const headerScriptNode = document.createRange().createContextualFragment(tagManagerHeaderTag);
    document.head.appendChild(headerScriptNode);
    
    const bodyScriptNode = document.createRange().createContextualFragment(tagManagerBodyTag);
    document.body.appendChild(bodyScriptNode);
}

function setupBigIntSerialization() {
    // Needed for serializing ChatId values
    (BigInt.prototype as any).toJSON = function() { return this.toString(); };
}

function hideDropdownMenus() {
    window.onclick = function (event: any) {
        if (event.target.matches(".hide-on-click-ignore, .hide-on-click-ignore *, .hide-on-click-outside, .hide-on-click-outside *"))
            return;

        const dropdowns = document.getElementsByClassName("hide-on-click-outside");
        for (const dropdown of dropdowns) {
            dropdown.classList.add("hide");
        }
    }
}
