export function add<T>(array: T[], item: T) : boolean {
    if (array.includes(item)) {
        return false;
    }

    array.push(item);
    return true;
}

export function remove<T>(array: T[], item: T) : boolean {
    const index = array.indexOf(item);
    if (index < 0) {
        return false;
    }

    array.splice(index, 1);
    return true;
}

export function union<T>(left: T[], right: T[]) : T[] {
    const clone = left.slice();
    unionWith(clone, right);
    return clone;
}

export function unionWith<T>(left: T[], right: T[]) : void {
    return right.filter(x => !left.includes(x)).forEach(x => left.push(x));
}

export function except<T>(left: T[], right: T[]) : T[] {
    const clone = left.slice();
    exceptWith(clone, right);
    return clone;
}

export function exceptWith<T>(left: T[], right: T[]) : void {
    right.forEach(x => {
        const index = left.indexOf(x);
        if (index >= 0) {
            left.splice(index, 1);
        }
    })
}
