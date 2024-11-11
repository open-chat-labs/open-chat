export type DateRange = { date: Date; range: [Date, Date] };
let monthTitle = $state<string>("");
const selectedMonth = $state<number>(0);
const selectedRange = $state<DateRange>({
    date: new Date(),
    range: [new Date(), new Date()],
});

export const calendarState = {
    monthTitle,
    selectedMonth,
    selectedRange,
};
