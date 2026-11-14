import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ALT_NAME } from "@/lib/identity";

// module scope: evaluated at build, fine for a footer year
const YEAR = new Date().getFullYear();

export async function SiteFooter({ name, location }: { name: string; location: string }) {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-line px-4 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p>
            © {YEAR} {name} · {t("role", { location })}
          </p>
          <p>
            {t("aka", { alt: ALT_NAME })} · {t("made")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/about" className="transition-colors hover:text-ink">
            {t("about")}
          </Link>
          <a href="#main" className="transition-colors hover:text-ink">
            {t("top")} ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
