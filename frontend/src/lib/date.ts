// Dates are formatted by hand, not with Intl: Chrome ships without Azerbaijani date data
// ("2024 M03 5" instead of "5 mar 2024"), which also broke hydration against Node's full ICU.
// UTC so the server and every browser show the same day.
const MONTHS = {
  az: {
    long: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
    short: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"],
  },
  en: {
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
} as const;

export function formatDate(iso: string, locale: string, month: "short" | "long" = "long"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[locale === "en" ? "en" : "az"][month][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
