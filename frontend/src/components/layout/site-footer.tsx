import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ALT_NAME } from "@/lib/identity";

// module scope: evaluated at build, fine for a footer year
const YEAR = new Date().getFullYear();

export async function SiteFooter({ name, location }: { name: string; location: string }) {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-line bg-bg-2 py-10 text-sm text-muted">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
        <Link href="/" translate="no" className="notranslate display inline-flex min-h-11 items-center text-xl font-bold text-ink">
          antiqa<span className="text-rose">.code</span>
        </Link>
        <div className="space-y-1 sm:mr-auto">
          <p>
            © {YEAR}{" "}
            <span translate="no" className="notranslate">
              {name}
            </span>{" "}
            · {t("role", { location })}
          </p>
          <p>
            {t.rich("aka", { alt: ALT_NAME, name: (s) => <span translate="no" className="notranslate">{s}</span> })} ·{" "}
            {t.rich("made", { tech: (s) => <span translate="no" className="notranslate">{s}</span> })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="#main" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium transition-colors hover:bg-pink-soft hover:text-ink">
            {t("top")} ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
