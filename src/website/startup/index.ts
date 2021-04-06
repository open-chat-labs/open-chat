import tagManagerHeaderTag from "../analytics/ga/tagManagerHeaderScript.html";
import tagManagerBodyTag from "../analytics/ga/tagManagerBodyScript.html";

export default function() {
    insertGoogleTagManagerScripts();
    setupBigIntSerialization();
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
