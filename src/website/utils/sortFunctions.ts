
export function compareBy(property: string, caseInsensitive: boolean) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a: any, b: any) {
        // this works with strings and numbers
        let a1 = a[property];
        let b1 = b[property];
        
        if (caseInsensitive) {
            a1 = a1.toString().toLower();
            b1 = b1.toString().toLower();
        }

        var result = (a1 < b1) ? -1 : (a1 > b1) ? 1 : 0;
        return result * sortOrder;
    }
}