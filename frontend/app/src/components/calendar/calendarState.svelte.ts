export type DateRange = { date: Date; range: [Date, Date] };

// let monthTitle = $state("");
// let selectedMonth = $state(0);
// let selectedRange = $state<DateRange>({
//     date: new Date(),
//     range: [new Date(), new Date()],
// });

// class CalendarState {
//     get monthTitle() {
//         return monthTitle;
//     }
//     set monthTitle(value: string) {
//         monthTitle = value;
//     }
//     get selectedMonth() {
//         return selectedMonth;
//     }
//     set selectedMonth(value: number) {
//         selectedMonth = value;
//     }

//     get selectedRange() {
//         return selectedRange;
//     }
//     set selectedRange(value: DateRange) {
//         selectedRange = value;
//     }
// }

// This *would* work and in much less verbose. But something converts the code
// and puts the $state initialisation in the constructor which is not allowed.
// To improve this I need to discover what is causing that particular pre-processing ...
// class CalendarState {
//     monthTitle = $state("");
//     selectedMonth = $state(0);
//     selectedRange = $state<DateRange>({
//         date: new Date(),
//         range: [new Date(), new Date()],
//     });
// }

class CalendarState {
    monthTitle = $state("cocktober");
    selectedMonth = 0;
    selectedRange: DateRange = {
        date: new Date(),
        range: [new Date(), new Date()],
    };
}

// This also works for reference but it doesn't support derived state
// export const calendarState = $state({
//     monthTitle: "",
//     selectedMonth: 0,
//     selectedRange: {
//         date: new Date(),
//         range: [new Date(), new Date()],
//     },
// });

export const calendarState = new CalendarState();
