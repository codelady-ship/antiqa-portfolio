import { PERSONA, type Pose } from "./config";
import { PersonaFigure, WaveHand } from "./figure";

/** Speech bubble + (hero) waving hand around the figure box. Decorative. (The floating tech chips
 * are gone, owner 2026-11-16: "proqramlaşdırma dilləri lazım deyil".) */
export function PersonaExtras({ bubble, wave }: { bubble?: string; wave?: boolean }) {
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
  wave,
}: {
  id: "hero" | "about";
  pose?: Pose;
  className?: string;
  bubble?: string;
  wave?: boolean;
}) {
  return (
    <div data-persona-slot={id} data-pose={PERSONA.poses[pose] ? "idle" : pose} className={`relative aspect-[677/800] ${className}`}>
      <div className="persona-static absolute inset-0">
        {/* with a real pose image the image is the pose; without, the photo leans (CSS) */}
        <div className="ring-figure">
          <PersonaFigure alt="" sizes="(min-width: 1536px) 384px, 336px" src={PERSONA.poses[pose] ?? PERSONA.poses.idle} eager={id === "hero"} />
        </div>
        <PersonaExtras bubble={bubble} wave={wave} />
      </div>
    </div>
  );
}
