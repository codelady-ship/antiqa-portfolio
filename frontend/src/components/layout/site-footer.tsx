import { getTranslations } from "next-intl/server";

// module scope: evaluated at build, fine for a footer year
const YEAR = new Date().getFullYear();

export async function SiteFooter({ name }: { name: string }) {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-line px-4 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p>
          © {YEAR} {name} · {t("made")}
        </p>
        <a href="#main" className="transition-colors hover:text-ink">
          {t("top")} ↑
        </a>
      </div>
    </footer>
  );
}
