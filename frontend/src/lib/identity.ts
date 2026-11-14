import { SITE_URL } from "./data";

/**
 * Other ways her name is written (passport/LinkedIn "Entiqə/Entiqe", ASCII without ə, handles).
 * Used in Person JSON-LD, llms*.txt and once in visible text so name searches find the site.
 */
export const NAME_SPELLINGS = ["Entiqə Cəlilova", "Entiqe Celilova", "Antiqa Celilova", "Antiqa", "antiqacode", "codelady"];

/** Visible alternate spelling, shown in the footer and on /about. */
export const ALT_NAME = "Entiqə (Entiqe) Cəlilova";
/** Same, without parentheses, for use inside a parenthetical (meta descriptions). */
export const ALT_NAME_INLINE = "Entiqə / Entiqe Cəlilova";

export const JOB_TITLE = "Frontend / Full Stack Developer";

/** Absolute URL of the shared preview image (the generated OG card; there is no photo yet). */
export const PERSON_IMAGE = `${SITE_URL}/en/opengraph-image`;
