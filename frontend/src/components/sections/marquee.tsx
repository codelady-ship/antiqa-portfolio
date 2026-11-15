const TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-mint-soft", "bg-peach-soft", "bg-butter-soft"];

/**
 * One slim, slowly sliding row of the tools she uses (#32: small, calm type instead of two
 * rows of giant outlined words). Pure CSS; it pauses on hover and stops for reduced motion.
 */
export function Marquee({ items, label }: { items: string[]; label: string }) {
  const row = [...items, ...items].map((s, i) => (
    <li key={i} className={`mr-3 flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-semibold whitespace-nowrap ${TINTS[i % TINTS.length]}`}>
      {s}
    </li>
  ));

  return (
    // tech names are brand names: translate="no" (Chrome rendered "React" as a verb, #21), lang="en"
    <section aria-label={label} data-shot="skills" className="marquee-host type-marquee overflow-hidden border-y border-line bg-surface py-4">
      <ul className="sr-only notranslate" translate="no" lang="en">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div aria-hidden translate="no" lang="en" className="notranslate [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        <ul className="marquee">{row}</ul>
      </div>
    </section>
  );
}
