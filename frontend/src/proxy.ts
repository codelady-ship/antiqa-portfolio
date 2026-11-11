import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // everything except API, Next internals and files with an extension
  matcher: ["/((?!api|admin-revalidate|_next|_vercel|.*\\..*).*)"],
};
