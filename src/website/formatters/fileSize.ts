const unitTypes: string[] = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB"
];

export default function format(bytes: number) : string {
    let value: number = Math.ceil(bytes);
    let unitType: number = 0;
    while (value >= 1024 && unitType < unitTypes.length - 1) {
        value = value / 1024;
        unitType++;
    }
    const showDecimal = unitType > 0 && value < 9.95; // Since 9.95.toFixed(1) will display '10.0', whereas we want '10'
    const formattedValue = value.toFixed(showDecimal ? 1 : 0);
    const unit = unitTypes[unitType];

    return `${formattedValue} ${unit}`;
}