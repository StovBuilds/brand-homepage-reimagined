// An UNOFFICIAL concept homepage. The brand is named in plain text as the
// subject of the study; every asset on the page is ours: the trainer (see
// tools/), the type treatment, the scenes, the copy. No logos, no product
// names, no photography from the brand. Scroll runs the film; `?p=0.5` pins a
// frame, `?qa=1` exposes window.__conceptQA.

import { useEffect, useRef, useState } from "react";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import { BRAND, CALLOUTS, CARDS, SPORTS } from "./brand";
import { COLOURWAYS, T, clamp01, colourwayAt, createStage, cwEdges, pulse, seg, smooth, type Stage } from "./stage";

const SCROLL_VH = 1150;
const SPORT_AT = (i: number) => T.run[0] + 0.006 + i * 0.043;

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const forcedP = parseFloat(params.get("p") ?? "");
const QA = params.get("qa") === "1";

const webglOk = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};

const Concept = () => {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "flat">("loading");

  useEffect(() => {
    document.title = BRAND.docTitle;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = "noindex, nofollow";
    return () => {
      if (created) meta!.remove();
      else meta!.content = prev;
    };
  }, []);

  useEffect(() => {
    const el = root.current!;
    const q = <E extends HTMLElement = HTMLElement>(s: string) => el.querySelector<E>(s)!;
    const qa = <E extends HTMLElement = HTMLElement>(s: string) => Array.from(el.querySelectorAll<E>(s));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = !Number.isNaN(forcedP) || reduced;
    let stage: Stage | null = null;
    if (webglOk() && canvas.current) {
      try {
        stage = createStage(canvas.current, BRAND.model);
        stage.ready.then(() => setPhase("ready")).catch(() => setPhase("flat"));
      } catch {
        setPhase("flat");
      }
    } else setPhase("flat");

    const heroBack = qa(".nk-hero.back .ln");
    const heroFront = qa(".nk-hero.front .ln");
    const heroWrap = qa(".nk-hero");
    const heroCopy = q(".nk-herocopy");
    const bBlack = q(".b-black");
    const bCw = qa(".b-cw");
    const bFin = q(".b-fin");
    const anat = q(".nk-anat");
    const ghost = q(".nk-ghost");
    const svg = el.querySelector<SVGSVGElement>(".nk-leaders")!;
    const labels = qa(".nk-callout");
    const words = qa(".nk-word");
    const runCap = q(".nk-runcap");
    const runCapWord = q(".nk-runcap b");
    const runCapLine = q(".nk-runcap span");
    const cwUi = q(".nk-cw");
    const cwNames = qa(".nk-cwname");
    const cwCount = q(".nk-cwcount");
    const chips = qa<HTMLButtonElement>(".nk-chip");
    const join = q(".nk-join");
    const finBack = q(".nk-fin.back .ln");
    const finFront = q(".nk-fin.front .ln");
    const finWrap = qa(".nk-fin");
    const credit = q(".nk-credit");
    const rail = q(".nk-rail i");
    const navLinks = qa<HTMLButtonElement>(".nk-nav button[data-to]");

    const show = (e: HTMLElement | SVGElement, o: number) => {
      e.style.opacity = o.toFixed(3);
      e.style.visibility = o <= 0.004 ? "hidden" : "visible";
    };
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    const target = () => (!Number.isNaN(forcedP) ? clamp01(forcedP) : maxScroll() > 0 ? clamp01(window.scrollY / maxScroll()) : 0);
    const goTo = (p: number) => window.scrollTo({ top: p * maxScroll(), behavior: reduced ? "auto" : "smooth" });

    const onNav = (e: Event) => goTo(parseFloat((e.currentTarget as HTMLElement).dataset.to!));
    navLinks.forEach((b) => b.addEventListener("click", onNav));
    const edges = cwEdges();
    const cwW = (T.cw[1] - T.cw[0]) / COLOURWAYS.length;
    const onChip = (e: Event) => goTo(edges[parseInt((e.currentTarget as HTMLElement).dataset.i!, 10)] + cwW * 0.5);
    chips.forEach((b) => b.addEventListener("click", onChip));

    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const onResize = () => stage?.resize();
    window.addEventListener("resize", onResize);

    let p = target();
    let vel = 0;
    let last = performance.now();
    let raf = 0;
    let lastSport = -1, lastCw = -1;
    const pt = { x: 0, y: 0 };
    const bd = { min: 0, max: 0 };
    const t0 = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tp = target();
      const prev = p;
      p = still ? tp : p + (tp - p) * Math.min(1, dt * 6.5);
      if (Math.abs(tp - p) < 0.00002) p = tp;
      vel += ((p - prev) / Math.max(dt, 0.001) - vel) * Math.min(1, dt * 8);
      const W = window.innerWidth, H = window.innerHeight;
      const narrow = W / H < 0.9;
      const kick = Math.max(-9, Math.min(9, vel * 55));
      el.style.setProperty("--sk", `${(-9 - kick).toFixed(2)}deg`);

      // ── hero
      const hp = smooth(seg(0, 0.17, p));
      const ho = 1 - seg(0.125, 0.185, p);
      heroWrap.forEach((h) => show(h, ho));
      const hx = [-78, 84, -120];
      [heroBack, heroFront].forEach((set) =>
        set.forEach((ln, i) => {
          ln.style.transform = `translate3d(calc(${(hx[i] * hp).toFixed(2)}vw + ${(mx * -(14 + i * 20)).toFixed(1)}px), ${(my * -(6 + i * 8)).toFixed(1)}px, 0) skewX(var(--sk))`;
        }),
      );
      show(heroCopy, 1 - seg(0.015, 0.07, p));

      // ── background wipes
      const w = seg(T.wipe[0], T.wipe[1], p);
      bBlack.style.clipPath = `polygon(0 ${Math.max(0, 100 - w * 132)}%, 100% ${Math.max(0, 132 - w * 132)}%, 100% 100%, 0 100%)`;
      bBlack.style.visibility = w <= 0 ? "hidden" : "visible";
      bCw.forEach((b, i) => {
        const r = smooth(seg(edges[i] - 0.006, edges[i] + 0.02, p)) * 150;
        b.style.clipPath = `circle(${r.toFixed(2)}vmax at 50% 52%)`;
        b.style.visibility = r <= 0 ? "hidden" : "visible";
      });
      const f = seg(T.finale[0], T.finale[0] + 0.04, p);
      bFin.style.clipPath = `inset(${((1 - smooth(f)) * 100).toFixed(2)}% 0 0 0)`;
      bFin.style.visibility = f <= 0 ? "hidden" : "visible";

      // ── anatomy
      const ap = pulse(T.anatomy[0] + 0.005, T.anatomy[0] + 0.03, T.anatomy[1] - 0.025, T.anatomy[1], p);
      show(anat, ap);
      show(ghost, ap * 0.9);
      ghost.style.transform = `translate3d(${(mx * -24).toFixed(1)}px, ${((seg(T.anatomy[0], T.anatomy[1], p) - 0.5) * -26).toFixed(2)}vh, 0) skewX(var(--sk))`;
      const cv = pulse(T.explode[0] + 0.02, T.explode[1], T.explode[2], T.explode[3] - 0.02, p);
      show(svg, cv);
      let lines = "";
      if (cv > 0.004) stage?.bounds(bd);
      labels.forEach((lab, i) => {
        show(lab, cv);
        if (cv <= 0.004 || !stage || !stage.anchor(CALLOUTS[i].part, pt)) return;
        const side = CALLOUTS[i].side;
        const lw = lab.offsetWidth;
        const gap = narrow ? 6 : 28;
        let lx = side > 0 ? bd.max + gap : bd.min - gap - lw;
        lx = Math.max(10, Math.min(W - lw - 10, lx));
        const ly = pt.y - 18;
        lab.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        const ex = side > 0 ? lx - 6 : lx + lw + 6;
        lines += `<line x1="${pt.x.toFixed(1)}" y1="${pt.y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${(ly + 9).toFixed(1)}"/><circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3"/>`;
      });
      if (cv > 0.004) svg.innerHTML = lines;

      // ── run: the category words come through the screen
      const runAmt = pulse(T.run[0], T.run[0] + 0.03, T.run[1] - 0.025, T.run[1], p);
      let active = -1;
      words.forEach((wd, i) => {
        const wv = seg(SPORT_AT(i), SPORT_AT(i) + 0.078, p);
        const o = Math.min(seg(0, 0.12, wv), 1 - seg(0.72, 1, wv));
        show(wd, o);
        if (o > 0.004) {
          const sc = 0.1 * Math.pow(70, wv);
          wd.style.transform = `translate3d(${(mx * -30 * sc).toFixed(1)}px, ${(my * -14 * sc).toFixed(1)}px, 0) scale(${sc.toFixed(4)}) skewX(var(--sk))`;
        }
        if (wv > 0.3 && wv < 1) active = i;
        if (wv >= 1 && i === words.length - 1) active = i;
      });
      if (active < 0) active = p < SPORT_AT(1) ? 0 : words.length - 1;
      if (active !== lastSport) {
        lastSport = active;
        runCapWord.textContent = SPORTS[active].word;
        runCapLine.textContent = SPORTS[active].line;
      }
      show(runCap, runAmt);

      // ── colourways
      const cp = pulse(T.cw[0] - 0.012, T.cw[0] + 0.012, T.cw[1] - 0.012, T.cw[1] + 0.008, p);
      show(cwUi, cp);
      const ci = colourwayAt(Math.min(Math.max(p, T.cw[0]), T.cw[1] - 0.0001));
      cwNames.forEach((nm, i) => {
        const n = (p - edges[i]) / cwW;
        const o = cp * pulse(-0.12, 0.2, 0.8, 1.12, n);
        show(nm, o);
        if (o > 0.004) nm.style.transform = `translate3d(calc(${((0.5 - n) * 46).toFixed(2)}vw + ${(mx * -26).toFixed(1)}px), 0, 0) skewX(var(--sk))`;
      });
      if (ci !== lastCw) {
        lastCw = ci;
        cwCount.textContent = `0${ci + 1} / 0${COLOURWAYS.length}`;
        chips.forEach((c, i) => c.setAttribute("aria-pressed", String(i === ci)));
        cwUi.style.setProperty("--ink", COLOURWAYS[ci].ink === "#d6ff1f" ? "#ffffff" : "#0b0b0c");
      }

      // ── join
      const jp = pulse(T.join[0], T.join[0] + 0.025, T.join[1] - 0.02, T.join[1], p);
      show(join, jp);
      join.style.setProperty("--fan", smooth(seg(T.join[0] + 0.012, T.join[0] + 0.065, p)).toFixed(4));
      join.style.setProperty("--drift", ((seg(T.join[0], T.join[1], p) - 0.5) * 2).toFixed(4));

      // ── finale
      const fp = smooth(seg(T.finale[0] + 0.012, T.finale[0] + 0.058, p));
      finWrap.forEach((fw) => show(fw, seg(T.finale[0] + 0.008, T.finale[0] + 0.02, p)));
      finBack.style.transform = `translate3d(calc(${((1 - fp) * -105 - (narrow ? 0 : 13)).toFixed(2)}vw + ${(mx * -16).toFixed(1)}px), 0, 0) skewX(var(--sk))`;
      finFront.style.transform = `translate3d(calc(${((1 - fp) * 105 + (narrow ? 0 : 11)).toFixed(2)}vw + ${(mx * -44).toFixed(1)}px), 0, 0) skewX(var(--sk))`;
      const co = smooth(seg(0.962, 0.992, p));
      show(credit, co);
      credit.style.transform = `translate3d(0, ${((1 - co) * 40).toFixed(1)}px, 0)`;

      rail.style.transform = `scaleY(${p.toFixed(4)})`;
      el.dataset.dark = p > T.wipe[0] + 0.035 && p < edges[0] - 0.005 ? "1" : colourwayAt(p) === 1 && p > T.cw[0] && p < T.cw[1] ? "1" : "0";

      stage?.frame({ p, time: (now - t0) / 1000, dt, mx: still ? 0 : mx, my: still ? 0 : my, speed: vel, still });
      if (QA) (window as unknown as Record<string, unknown>).__conceptQA = { p, vel, narrow, cw: ci, sport: active };
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      navLinks.forEach((b) => b.removeEventListener("click", onNav));
      chips.forEach((b) => b.removeEventListener("click", onChip));
      stage?.dispose();
    };
  }, []);

  const heroLines = BRAND.heroLines;

  return (
    <div className="nk" ref={root} data-phase={phase} data-dark="0">
      <style>{CSS}</style>
      <div style={{ height: `${SCROLL_VH}vh` }} aria-hidden />

      <div className="nk-stage">
        <div className="nk-bg b-black" />
        {COLOURWAYS.map((c) => (
          <div key={c.name} className="nk-bg b-cw" style={{ background: c.bg }} />
        ))}
        <div className="nk-bg b-fin" />

        {/* ── behind the trainer ── */}
        <div className="nk-layer">
          <h1 className="nk-hero back">
            {heroLines.map((l, i) => (
              <span key={l} className={`ln l${i}`}>{l}</span>
            ))}
          </h1>
          <div className="nk-ghost" aria-hidden>01</div>
          <div className="nk-words" aria-hidden>
            {SPORTS.map((s, i) => (
              <span key={s.word} className={`nk-word w${i % 2}`}>{s.word}</span>
            ))}
          </div>
          <div className="nk-cwnames" aria-hidden>
            {COLOURWAYS.map((c) => (
              <span key={c.name} className="nk-cwname" style={{ color: c.ink }}>{c.name}</span>
            ))}
          </div>
          <div className="nk-fin back" aria-hidden>
            <span className="ln">{BRAND.finale[0]}</span>
          </div>
        </div>

        <canvas ref={canvas} className="nk-canvas" />

        {/* ── in front of the trainer ── */}
        <div className="nk-layer">
          <div className="nk-hero front" aria-hidden>
            {heroLines.map((l, i) => (
              <span key={l} className={`ln l${i}`}>{l}</span>
            ))}
          </div>
          <div className="nk-herocopy">
            <p className="nk-kicker">{BRAND.heroKicker}</p>
            <p>{BRAND.heroLine}</p>
            <span className="nk-cue">SCROLL<i /></span>
          </div>

          <section className="nk-anat">
            <p className="nk-kicker">01 · TAKEN APART</p>
            <h2>FOUR PARTS.<br />NOTHING SPARE.</h2>
            <p>Every piece of Runner 01 is its own object, so the page can pull the shoe apart in front of you and put it back before you blink.</p>
            <dl>
              <div><dt>LENGTH</dt><dd>29 CM</dd></div>
              <div><dt>COLOURWAYS</dt><dd>4</dd></div>
              <div><dt>PARTS</dt><dd>4</dd></div>
            </dl>
          </section>
          <svg className="nk-leaders" aria-hidden />
          <div className="nk-callouts" aria-hidden>
            {CALLOUTS.map((c) => (
              <div key={c.part} className="nk-callout" data-side={c.side}>
                <b>{c.label}</b>
                <span>{c.sub}</span>
              </div>
            ))}
          </div>

          <section className="nk-runcap">
            <p className="nk-kicker">02 · PICK YOUR GROUND</p>
            <h2><b>RUN</b></h2>
            <span>{SPORTS[0].line}</span>
          </section>

          <section className="nk-cw">
            <p className="nk-kicker">03 · COLOURWAYS</p>
            <div className="nk-cwcount">01 / 04</div>
            <div className="nk-chips">
              {COLOURWAYS.map((c, i) => (
                <button key={c.name} className="nk-chip" data-i={i} aria-pressed={i === 0} aria-label={c.name} style={{ background: c.chip }} />
              ))}
            </div>
          </section>

          <section className="nk-join">
            <p className="nk-kicker">04 · MEMBERS</p>
            <h2>MEMBERS<br />GO FIRST.</h2>
            <div className="nk-cards">
              {CARDS.map((c, i) => (
                <article key={c.k} className="nk-card" style={{ ["--i" as string]: i - 1 }}>
                  <em>{c.k}</em>
                  <h3>{c.h}</h3>
                  <p>{c.b}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="nk-fin front">
            <span className="ln">{BRAND.finale[1]}</span>
          </div>
          <section className="nk-credit">
            <div>
              <p className="nk-kicker">UNOFFICIAL CONCEPT</p>
              <p>
                A design experiment by Adapt, Progress, Evolve. Not affiliated with, endorsed by or
                connected to {BRAND.owner} {BRAND.name} is a trademark of {BRAND.owner} Everything on this
                page, the trainer, the type, the scenes and the words, was made by us. Runner 01 is not a
                real product and the copy is placeholder.
              </p>
            </div>
            <a className="nk-cta" href={BRAND.cta.href} target="_blank" rel="noopener">
              {BRAND.cta.label} <span aria-hidden>→</span>
            </a>
          </section>
        </div>

        {/* ── chrome ── */}
        <header className="nk-nav">
          <div className="nk-mark">{BRAND.wordmark}<small>{BRAND.wordmarkSub}</small></div>
          <nav>
            <button data-to={T.anatomy[0] + 0.1}>The shoe</button>
            <button data-to={T.run[0] + 0.05}>Sport</button>
            <button data-to={T.cw[0] + 0.02}>Colour</button>
            <button data-to={T.join[0] + 0.07}>Members</button>
          </nav>
        </header>
        <div className="nk-tag">Unofficial concept · not affiliated with {BRAND.owner}</div>
        <div className="nk-rail" aria-hidden><i /></div>
        {phase === "loading" && <div className="nk-loading" aria-hidden>LOADING</div>}
      </div>
    </div>
  );
};

const CSS = `
.nk{--orange:#ff4a1c;--ink:#0b0b0c;--volt:#d6ff1f;--paper:#f4f3ef;--sk:-9deg;background:var(--orange);color:var(--ink);font-family:Inter,system-ui,sans-serif}
.nk *{box-sizing:border-box}
.nk-stage{position:fixed;inset:0;overflow:hidden;background:var(--orange)}
.nk-bg,.nk-layer{position:absolute;inset:0}
.nk-bg{will-change:clip-path}
.b-black{background:var(--ink)}
.b-fin{background:var(--orange)}
.nk-layer{pointer-events:none}
.nk-layer a,.nk-layer button{pointer-events:auto}
.nk-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.nk[data-phase="flat"] .nk-canvas{display:none}

.nk h1,.nk h2,.nk h3,.nk-ghost,.nk-word,.nk-cwname,.nk-fin,.nk-mark,.nk-cwcount{font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;margin:0;letter-spacing:0;text-transform:uppercase}
.nk-kicker{font:600 11px/1 Inter,sans-serif;letter-spacing:.16em;margin:0 0 14px}

/* hero + finale: lines stacked dead centre, split across the two layers */
.nk-hero,.nk-fin{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:min(34vw,30vh);line-height:.8;padding-top:4vh}
.nk-hero .ln,.nk-fin .ln{display:block;white-space:nowrap;will-change:transform;transform:skewX(var(--sk))}
.nk-hero{align-items:flex-start;padding-left:clamp(18px,4vw,56px)}
.nk-hero.back .l0{color:#fff}
.nk-hero.back .l1{color:var(--ink)}
.nk-hero.back .l2,.nk-hero.front .l0,.nk-hero.front .l1{opacity:0}
.nk-hero.front .l2,.nk-fin.front .ln{color:transparent;-webkit-text-stroke:max(2px,.012em) var(--ink)}
.nk-fin{font-size:min(40vw,34vh);padding-top:0}
.nk-fin.back{justify-content:flex-start;padding-top:calc(50vh - .86em)}
.nk-fin.front{justify-content:flex-start;padding-top:calc(50vh - .06em)}
.nk-fin.back .ln{color:#fff}

.nk-herocopy{position:absolute;right:clamp(18px,4vw,56px);bottom:clamp(64px,9vh,96px);max-width:300px;font-size:15px;line-height:1.45}
.nk-herocopy p{margin:0 0 18px}
.nk-cue{display:inline-flex;align-items:center;gap:12px;font:600 11px/1 Inter,sans-serif;letter-spacing:.16em}
.nk-cue i{display:block;width:1px;height:38px;background:currentColor;transform-origin:top;animation:nk-cue 1.6s cubic-bezier(.6,0,.2,1) infinite}
@keyframes nk-cue{0%{transform:scaleY(0)}55%{transform:scaleY(1)}100%{transform:scaleY(1);opacity:0}}

/* anatomy */
.nk-ghost{position:absolute;left:-2vw;top:50%;margin-top:-.42em;font-size:min(78vw,96vh);line-height:.84;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.16)}
.nk-anat{position:absolute;left:clamp(18px,5vw,72px);top:50%;transform:translateY(-50%);width:min(400px,34vw);color:#fff}
.nk-anat h2{font-size:clamp(46px,6.2vw,104px);line-height:.88;margin:0 0 20px}
.nk-anat>p:not(.nk-kicker){font-size:15px;line-height:1.5;color:rgba(255,255,255,.72);margin:0 0 26px}
.nk-anat .nk-kicker,.nk-runcap .nk-kicker{color:var(--volt)}
.nk-anat dl{display:flex;gap:28px;margin:0;border-top:1px solid rgba(255,255,255,.2);padding-top:16px}
.nk-anat dt{font:600 10px/1 Inter,sans-serif;letter-spacing:.14em;color:rgba(255,255,255,.55);margin-bottom:8px}
.nk-anat dd{margin:0;font:400 30px/1 "Bebas Neue",sans-serif}
.nk-leaders{position:absolute;inset:0;width:100%;height:100%}
.nk-leaders line{stroke:rgba(214,255,31,.6);stroke-width:1}
.nk-leaders circle{fill:var(--volt)}
.nk-callout{position:absolute;left:0;top:0;white-space:nowrap;color:#fff;will-change:transform;text-shadow:0 0 10px #0b0b0c,0 0 4px #0b0b0c}
.nk-callout b{display:block;font:400 22px/1 "Bebas Neue",sans-serif;letter-spacing:.02em}
.nk-callout span{display:block;font-size:11px;color:rgba(255,255,255,.6);margin-top:3px}
.nk-callout[data-side="-1"]{text-align:right}

/* run */
.nk-words{position:absolute;inset:0;display:grid;place-items:center}
.nk-word{grid-area:1/1;font-size:min(46vw,60vh);line-height:.8;will-change:transform,opacity}
.nk-word.w0{color:var(--volt)}
.nk-word.w1{color:transparent;-webkit-text-stroke:2px #fff}
.nk-runcap{position:absolute;left:clamp(18px,5vw,72px);bottom:clamp(70px,11vh,120px);color:#fff}
.nk-runcap h2{font-size:clamp(56px,7vw,112px);line-height:.86}
.nk-runcap h2 b{font-weight:400}
.nk-runcap>span{display:block;font-size:15px;color:rgba(255,255,255,.72);margin-top:8px}

/* colourways */
.nk-cwnames{position:absolute;inset:0;display:grid;place-items:center}
.nk-cwname{grid-area:1/1;font-size:min(27vw,44vh);line-height:.8;white-space:nowrap;will-change:transform,opacity}
.nk-cw{--ink:#0b0b0c;position:absolute;inset:0;color:var(--ink)}
.nk-cw .nk-kicker{position:absolute;left:clamp(18px,5vw,72px);bottom:clamp(104px,15vh,150px)}
.nk-cwcount{position:absolute;left:clamp(18px,5vw,72px);bottom:clamp(56px,8vh,90px);font-size:44px;line-height:1}
.nk-chips{position:absolute;right:clamp(18px,5vw,72px);bottom:clamp(56px,8vh,90px);display:flex;gap:12px}
.nk-chip{width:44px;height:44px;border-radius:50%;border:2px solid var(--ink);padding:0;cursor:pointer;outline:2px solid transparent;outline-offset:3px;transition:transform .25s,outline-color .25s}
.nk-chip[aria-pressed="true"]{transform:scale(1.14);outline-color:var(--ink)}
.nk-chip:focus-visible{outline-color:var(--ink)}

/* members */
.nk-join{--fan:0;--drift:0;position:absolute;inset:0;color:var(--ink)}
.nk-join .nk-kicker{position:absolute;left:clamp(18px,5vw,72px);top:clamp(96px,16vh,150px);color:#2440ff}
.nk-join h2{position:absolute;left:clamp(18px,5vw,72px);top:clamp(120px,19vh,180px);font-size:clamp(64px,10vw,170px);line-height:.84;transform:translate3d(calc(var(--drift) * -4vw),0,0) skewX(var(--sk))}
.nk-cards{position:absolute;left:50%;bottom:clamp(70px,11vh,120px);width:min(300px,24vw);aspect-ratio:3/3.6}
.nk-card{position:absolute;inset:0;background:var(--ink);color:#fff;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;transform-origin:50% 120%;transform:translate3d(calc(-50% + var(--i) * var(--fan) * 108%),calc((1 - var(--fan)) * 70vh),0) rotate(calc(var(--i) * (var(--fan) * 5deg + var(--drift) * 2deg)));will-change:transform}
.nk-card:nth-child(2){background:#2440ff}
.nk-card:nth-child(3){background:var(--orange);color:var(--ink)}
.nk-card em{position:absolute;top:18px;left:22px;font:600 11px/1 Inter,sans-serif;letter-spacing:.16em;font-style:normal}
.nk-card h3{font-size:clamp(30px,2.8vw,44px);line-height:.9;margin:0 0 10px}
.nk-card p{margin:0;font-size:14px;line-height:1.4;opacity:.82}

/* finale credit */
.nk-credit{position:absolute;left:0;right:0;bottom:0;background:var(--ink);color:#fff;padding:22px clamp(18px,5vw,72px) 26px;display:flex;gap:32px;align-items:center;justify-content:space-between}
.nk-credit .nk-kicker{color:var(--volt);margin-bottom:10px}
.nk-credit p:not(.nk-kicker){margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,.74);max-width:760px}
.nk-cta{flex:none;display:inline-flex;align-items:center;gap:12px;background:var(--volt);color:var(--ink);font:600 15px/1 Inter,sans-serif;padding:18px 24px;border-radius:999px;text-decoration:none;transition:transform .2s}
.nk-cta:hover{transform:translateX(4px)}
.nk-cta:focus-visible{outline:2px solid #fff;outline-offset:3px}

/* chrome */
.nk-nav{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,4vw,56px);color:var(--ink);transition:color .3s}
.nk[data-dark="1"] .nk-nav{color:#fff}
.nk-mark{font-size:30px;line-height:1;transform:skewX(-9deg)}
.nk-mark small{font:600 10px/1 Inter,sans-serif;letter-spacing:.16em;margin-left:8px;vertical-align:middle}
.nk-nav nav{display:flex;gap:clamp(12px,2vw,30px)}
.nk-nav button{background:none;border:0;padding:8px 0;color:inherit;font:600 13px/1 Inter,sans-serif;cursor:pointer;border-bottom:2px solid transparent}
.nk-nav button:hover,.nk-nav button:focus-visible{border-bottom-color:currentColor;outline:none}
.nk-tag{position:absolute;left:50%;top:22px;transform:translateX(-50%);background:var(--ink);color:#fff;font:600 10px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:8px 12px;border-radius:999px;white-space:nowrap}
.nk[data-dark="1"] .nk-tag{background:#fff;color:var(--ink)}
.nk-rail{position:absolute;right:14px;top:50%;height:120px;margin-top:-60px;width:2px;background:rgba(128,128,128,.35)}
.nk-rail i{display:block;width:100%;height:100%;background:currentColor;transform-origin:top;transform:scaleY(0)}
.nk[data-dark="1"] .nk-rail{color:#fff}
.nk-loading{position:absolute;right:clamp(18px,4vw,56px);bottom:26px;font:600 11px/1 Inter,sans-serif;letter-spacing:.16em}

@media (max-width:760px){
  .nk-hero{font-size:min(35vw,24vh);align-items:center;padding-left:0;justify-content:flex-start;padding-top:14vh}
  .nk-mark small{display:none}
  .nk-fin{font-size:min(43vw,28vh)}
  .nk-nav nav{display:none}
  .nk-tag{left:auto;right:14px;top:20px;transform:none;font-size:8px;padding:7px 9px;letter-spacing:.06em}
  .nk-rail{display:none}
  .nk-herocopy{max-width:230px;font-size:14px;bottom:56px;right:auto;left:18px}
  .nk-anat{top:auto;bottom:40px;transform:none;width:auto;right:18px}
  .nk-anat h2{font-size:44px;margin-bottom:10px}
  .nk-anat>p:not(.nk-kicker){font-size:13px;margin-bottom:14px}
  .nk-anat dl{padding-top:12px}
  .nk-anat dd{font-size:24px}
  .nk-ghost{top:34%}
  .nk-callout b{font-size:15px}
  .nk-callout span{display:none}
  .nk-runcap{bottom:64px}
  .nk-cwname{font-size:min(30vw,26vh);transform-origin:center}
  .nk-cwnames{align-items:start;padding-top:17vh}
  .nk-cw .nk-kicker{bottom:118px}
  .nk-cwcount{bottom:66px;font-size:36px}
  .nk-chips{bottom:62px;gap:8px}
  .nk-join h2{font-size:19vw;top:27vh}
  .nk-join .nk-kicker{top:23vh}
  .nk-cards{width:29vw;bottom:11vh;aspect-ratio:3/4.4}
  .nk-card{padding:10px;transform:translate3d(calc(-50% + var(--i) * var(--fan) * 106%),calc((1 - var(--fan)) * 70vh + (var(--i) * var(--i)) * var(--fan) * 14px),0) rotate(calc(var(--i) * (var(--fan) * 4deg + var(--drift) * 2deg)))}
  .nk-card em{top:10px;left:10px}
  .nk-card h3{font-size:21px}
  .nk-card p{font-size:11px}
  .nk-credit{flex-direction:column;align-items:flex-start;gap:14px;padding:16px 18px 20px}
  .nk-credit p:not(.nk-kicker){font-size:11.5px}
  .nk-cta{padding:14px 18px;font-size:14px}
}
@media (prefers-reduced-motion:reduce){
  .nk-cue i{animation:none}
  .nk-chip,.nk-cta{transition:none}
}
`;

export default Concept;
