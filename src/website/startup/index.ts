import tagManagerHeaderTag from "../analytics/ga/tagManagerHeaderScript.html";
import tagManagerBodyTag from "../analytics/ga/tagManagerBodyScript.html";

export default function() {
    removeSpuriousStyleSheet();
    insertGoogleTagManagerScripts();
    setupBigIntSerialization();
}

function removeSpuriousStyleSheet() {
    // Temp hack!
    for (let i = 0; i < document.head.children.length; i++) {
        const node = document.head.children[i];
        if (node.tagName.toLowerCase() === "iframe") {
            const prev = document.head.children[i - 1];
            if (prev.tagName.toLowerCase() === "style") {
                node.parentElement!.removeChild(node.previousSibling!);
            }
            return;
        }
    }
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
