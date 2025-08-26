import { locale } from "svelte-i18n";
import { derived } from "svelte/store";
import { translationCodes } from "../../i18n/i18n";

type WeekDay = [string, string];
type WeekDayMap = Record<string, WeekDay[]>;

const map: WeekDayMap = {
    "zh-cn": [
        ["星期日", "日"],
        ["星期一", "一"],
        ["星期二", "二"],
        ["星期三", "三"],
        ["星期四", "四"],
        ["星期五", "五"],
        ["星期六", "六"],
    ],
    de: [
        ["Sonntag", "So"],
        ["Montag", "Mo"],
        ["Dienstag", "Di"],
        ["Mittwoch", "Mi"],
        ["Donnerstag", "Do"],
        ["Freitag", "Fr"],
        ["Samstag", "Sa"],
    ],
    en: [
        ["Sunday", "Su"],
        ["Monday", "Mo"],
        ["Tuesday", "Tu"],
        ["Wednesday", "We"],
        ["Thursday", "Th"],
        ["Friday", "Fr"],
        ["Saturday", "Sa"],
    ],
    es: [
        ["Domingo", "Do"],
        ["Lunes", "Lu"],
        ["Martes", "Ma"],
        ["Miércoles", "Mi"],
        ["Jueves", "Ju"],
        ["Viernes", "Vi"],
        ["Sábado", "Sa"],
    ],
    fr: [
        ["Dimanche", "Di"],
        ["Lundi", "Lu"],
        ["Mardi", "Ma"],
        ["Mercredi", "Me"],
        ["Jeudi", "Je"],
        ["Vendredi", "Ve"],
        ["Samedi", "Sa"],
    ],
    hi: [
        ["रविवार", "र"],
        ["सोमवार", "सो"],
        ["मंगलवार", "मं"],
        ["बुधवार", "बु"],
        ["गुरुवार", "गु"],
        ["शुक्रवार", "शु"],
        ["शनिवार", "श"],
    ],
    it: [
        ["Domenica", "Do"],
        ["Lunedì", "Lu"],
        ["Martedì", "Ma"],
        ["Mercoledì", "Me"],
        ["Giovedì", "Gi"],
        ["Venerdì", "Ve"],
        ["Sabato", "Sa"],
    ],
    iw: [
        ["יום ראשון", "א"],
        ["יום שני", "ב"],
        ["יום שלישי", "ג"],
        ["יום רביעי", "ד"],
        ["יום חמישי", "ה"],
        ["יום שישי", "ו"],
        ["שבת", "ש"],
    ],
    ja: [
        ["日曜日", "日"],
        ["月曜日", "月"],
        ["火曜日", "火"],
        ["水曜日", "水"],
        ["木曜日", "木"],
        ["金曜日", "金"],
        ["土曜日", "土"],
    ],
    ru: [
        ["Воскресенье", "Вс"],
        ["Понедельник", "Пн"],
        ["Вторник", "Вт"],
        ["Среда", "Ср"],
        ["Четверг", "Чт"],
        ["Пятница", "Пт"],
        ["Суббота", "Сб"],
    ],
    uk: [
        ["Неділя", "Нд"],
        ["Понеділок", "Пн"],
        ["Вівторок", "Вт"],
        ["Середа", "Ср"],
        ["Четвер", "Чт"],
        ["П’ятниця", "Пт"],
        ["Субота", "Сб"],
    ],
    vi: [
        ["Chủ Nhật", "CN"],
        ["Thứ Hai", "T2"],
        ["Thứ Ba", "T3"],
        ["Thứ Tư", "T4"],
        ["Thứ Năm", "T5"],
        ["Thứ Sáu", "T6"],
        ["Thứ Bảy", "T7"],
    ],
};

export const weekDays = derived(locale, (locale) => {
    const translated = translationCodes[locale || "en"] || "en";
    return map[translated] ?? map["en"];
});
