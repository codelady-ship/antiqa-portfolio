import { SITE_URL } from "./data";

/**
 * Other ways her name is written (passport/LinkedIn "Entiqə/Entiqe", ASCII without ə, handles).
 * Used in Person JSON-LD, llms*.txt and once in visible text so name searches find the site.
 */
export const NAME_SPELLINGS = ["Entiqə Cəlilova", "Entiqe Celilova", "Antiqa Celilova", "Antiqa Jalilova", "Antiqa", "antiqacode", "codelady"];

/** Visible alternate spelling, shown in the footer and on /about. */
export const ALT_NAME = "Entiqə (Entiqe) Cəlilova";
/** Same, without parentheses, for use inside a parenthetical (meta descriptions). */
export const ALT_NAME_INLINE = "Entiqə / Entiqe Cəlilova";

/** Her current role (Junior Full Stack Developer @ Aliyev Space, LinkedIn Oct 2026). Used in JSON-LD jobTitle and llms*.txt. */
export const JOB_TITLE = "Full Stack Developer";
/** Role plus main stack, for headings (OG image). LinkedIn-style subtitle: "Backend Developer | Java 21 · Spring Boot 3". */
export const JOB_STACK = "Java · Spring Boot · React/Next.js";
/** Years of experience the owner states ("1+ il / 1+ years", owner 2026-11-15); shown as "1+" on the home page. */
export const EXPERIENCE_YEARS = 1;

/** Absolute URL of the shared preview image (the generated OG card; there is no photo yet). */
export const PERSON_IMAGE = `${SITE_URL}/en/opengraph-image`;
