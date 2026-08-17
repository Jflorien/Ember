import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { EmailCapture } from "@/components/email-capture";
import { HpBar } from "@/components/hp-bar";
import { SlotPips } from "@/components/slot-pips";
import { ConditionPill } from "@/components/condition-pill";

const SCREENS = [
  {
    accent: "border-t-forge-500",
    route: "/dm",
    title: "The DM Console",
    device: "Desktop",
    description:
      "Narrative control, initiative tracking, hidden stats, and full undo — for when you do have a human DM.",
  },
  {
    accent: "border-t-frost",
    route: "/play",
    title: "The Player App",
    device: "Phone",
    description:
      "Your sheet, your inventory, your spell slots, your dice — always in your pocket, always in sync with the table.",
  },
  {
    accent: "border-t-molten-500",
    route: "/table",
    title: "The Table View",
    device: "TV",
    description:
      "The map everyone watches. Spells land, fire spreads, destruction sticks — one shared truth, rendered for the room.",
  },
] as const;

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <ThreeScreens />
        <HeatIsState />
        <TwoWaysToPlay />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section
      id="the-game"
      className="relative overflow-hidden border-b border-basalt-800"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 h-[32rem] w-[32rem] translate-x-1/3 rounded-full bg-[radial-gradient(circle_at_center,rgba(242,100,25,.28),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-0 h-[26rem] w-[26rem] -translate-x-1/3 rounded-full bg-[radial-gradient(circle_at_center,rgba(94,200,232,.12),transparent_70%)] blur-3xl"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:py-36">
        <span className="runic hot">AI-run tabletop RPG</span>
        <h1 className="font-display mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-[0.005em] sm:text-6xl bg-[linear-gradient(174deg,var(--ash-050)_26%,var(--forge-300)_68%,var(--molten-400))] bg-clip-text text-transparent">
          You don&rsquo;t need a dungeon master.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-ash-300">
          Ember is one. It builds the world, runs the rules, and reacts to
          whatever your party actually does — solo, or with friends, any
          night you feel like playing.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/signup" className="btn btn-forge">
            Get early access
          </Link>
          <Link href="#how-it-works" className="btn btn-iron">
            See how it works
          </Link>
        </div>

        <p className="mt-14 font-mono text-xs text-ash-500">
          SRD 5.2.1 · CC BY 4.0 · free during beta
        </p>
      </div>
    </section>
  );
}

function ThreeScreens() {
  return (
    <section id="three-screens" className="border-b border-basalt-800">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {SCREENS.map((screen) => (
            <div
              key={screen.route}
              className={`plate border-t-2 ${screen.accent} p-8`}
            >
              <div className="flex items-center justify-between">
                <span className="runic">{screen.device}</span>
                <span className="font-mono text-xs text-ash-500">
                  {screen.route}
                </span>
              </div>
              <h3 className="font-display mt-6 text-xl font-bold text-ash-050">
                {screen.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ash-300">
                {screen.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeatIsState() {
  return (
    <section id="how-it-works" className="border-b border-basalt-800">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="runic hot">The system</span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-tight tracking-[0.005em] text-ash-050 sm:text-4xl">
              Cold stone. Molten action.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-ash-300">
              Every screen follows one rule: cold stone is inert; anything
              alive, available or happening is lit. Spent resources, past
              turns and empty slots stay dark. HP, spell slots and active
              conditions glow — so the table can read the state of the game
              from across the room, not just from up close.
            </p>
          </div>

          <div className="plate flex flex-col gap-8 p-8">
            <div>
              <HpBar current={31} max={44} temp={6} />
            </div>
            <div>
              <div className="runic mb-3">Spell slots</div>
              <SlotPips
                groups={[
                  { level: 1, total: 4, spent: 0 },
                  { level: 2, total: 3, spent: 2 },
                ]}
              />
            </div>
            <div>
              <div className="runic mb-3">Conditions</div>
              <div className="flex flex-wrap gap-2">
                <ConditionPill name="Blessed" kind="buff" duration="1m" />
                <ConditionPill name="Poisoned" kind="debuff" duration="4r" />
                <ConditionPill
                  name="Concentrating"
                  kind="concentration"
                  duration="Hold Person"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TwoWaysToPlay() {
  return (
    <section className="border-b border-basalt-800">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="runic hot">Two ways to play</span>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-[0.005em] text-ash-050 sm:text-4xl">
            Bring your own DM, or don&rsquo;t.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="plate p-8">
            <span className="runic hot">No DM</span>
            <h3 className="font-display mt-4 text-xl font-bold text-ash-050">
              Ember runs it.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ash-300">
              An AI dungeon master proposes the same events a human would —
              narrating, adjudicating rules, and adapting to whatever your
              party decides to try.
            </p>
          </div>

          <div className="plate p-8">
            <span className="runic">You have a DM</span>
            <h3 className="font-display mt-4 text-xl font-bold text-ash-050">
              Ember becomes their console.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ash-300">
              Your DM runs the table exactly like they always have — Ember
              turns their calls into events: the map updates, sheets sync,
              and hidden information stays hidden, automatically.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ash-500">
          Both modes emit identical events. The table can&rsquo;t tell the
          difference — and neither can the rules engine.
        </p>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(242,100,25,.28),transparent_70%)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="runic hot">Private alpha</span>
        <h2 className="font-display mt-4 text-3xl font-bold tracking-[0.005em] text-ash-050 sm:text-4xl">
          Ember is in private alpha.
        </h2>
        <p className="mt-4 max-w-md text-ash-300">
          We&rsquo;re letting new tables in slowly. Leave your email and
          we&rsquo;ll reach out when there&rsquo;s room.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <EmailCapture />
        </div>
      </div>
    </section>
  );
}
