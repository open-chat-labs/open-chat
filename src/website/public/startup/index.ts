
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
        if (!event.target.matches('.ddl-button') && !event.target.matches('.ddl-button-svg')) {
            var dropdowns = document.getElementsByClassName("ddl-content");
            var i;
            for (i = 0; i < dropdowns.length; i++) {
                var openDropdown = dropdowns[i];
                if (openDropdown.classList.contains('show')) {
                    openDropdown.classList.remove('show');
                }
            }
        }
    }
}