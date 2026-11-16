import { PERSONA, type Pose } from "./config";
import { PersonaFigure, WaveHand } from "./figure";

const CHIP_SPOTS = ["-left-[24%] top-[18%]", "-right-[22%] top-[40%]", "-left-[28%] top-[52%]", "-right-[18%] top-[70%]", "left-[6%] -bottom-[5%]", "-left-[10%] -top-[4%]"];
const CHIP_TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-mint-soft", "bg-peach-soft", "bg-butter-soft", "bg-pink-soft"];

/** Speech bubble + (hero) waving hand + (about) tech chips around the figure box. Decorative. */
export function PersonaExtras({ bubble, chips, wave }: { bubble?: string; chips?: string[]; wave?: boolean }) {
  return (
    <>
      {bubble && (
        <p
          aria-hidden
          className="persona-bubble hand absolute top-[4%] -right-[6%] max-w-[12rem] -rotate-3 rounded-[1.4rem] border-2 border-ink bg-surface px-4 py-2.5 text-[1.3rem] leading-tight text-ink shadow-[4px_4px_0_var(--ink)]"
        >
          {bubble}
        </p>
      )}
      {wave && <WaveHand className="absolute top-[34%] -left-[12%] size-16" />}
      {chips && chips.length > 0 && (
        <ul aria-hidden translate="no" lang="en" className="notranslate">
          {chips.slice(0, 6).map((s, i) => (
            <li
              key={s}
              className={`absolute rounded-full border border-line px-3 py-1 text-[0.8125rem] font-semibold whitespace-nowrap shadow-[var(--shadow)] ${CHIP_SPOTS[i]} ${CHIP_TINTS[i]}`}
              style={{ rotate: `${[-6, 5, -3, 4, -2, 6][i]}deg` }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * A place where the travelling figure lands (persona-traveler.tsx): an empty box of the figure's
 * size. Inside is the static figure, shown when the traveller does not run (reduced motion, no JS,
 * screens < 1024 px have no slots at all) and hidden by `.persona-live` when it does.
 */
export function PersonaSlot({
  id,
  pose = "idle",
  className = "",
  bubble,
  chips,
  wave,
}: {
  id: "hero" | "about";
  pose?: Pose;
  className?: string;
  bubble?: string;
  chips?: string[];
  wave?: boolean;
}) {
  return (
    <div data-persona-slot={id} data-pose={PERSONA.poses[pose] ? "idle" : pose} className={`relative aspect-[677/800] ${className}`}>
      <div className="persona-static absolute inset-0">
        {/* with a real pose image the image is the pose; without, the photo leans (CSS) */}
        <div className="ring-figure">
          <PersonaFigure alt="" sizes="(min-width: 1536px) 384px, 336px" src={PERSONA.poses[pose] ?? PERSONA.poses.idle} eager={id === "hero"} />
        </div>
        <PersonaExtras bubble={bubble} chips={chips} wave={wave} />
      </div>
    </div>
  );
}
