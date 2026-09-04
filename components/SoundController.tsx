"use client";

/* ============================================================================
   SOUND CONTROLLER — adapta el sistema de audio de DICH™ Fashion al stack
   React/Next de WhyNot.

   3 audios:
     - bg-music.mp3 (loop, ambiente)
     - click.mp3    (click corto)
     - hover.mp3    (hover suave)

   Comunicacion con el resto de la app via eventos custom de window:
     - "whynot:sound-toggle"  → recibido: toggle on/off con fade 250ms
     - "whynot:sound-state"   → emitido:  detail { on: boolean } cada vez
                                que cambia el estado (para sync con Header)

   Reglas:
     - Click/hover sounds SOLO suenan cuando la musica esta activa (asi un
       usuario que no quiere audio nunca escucha nada — respeta la policy
       de autoplay del browser y la decision del usuario).
     - El click sound se dispara en cualquier <button>, <a>, [role=button]
       o input boton — salvo que el elemento tenga data-sound-skip.
     - El hover sound es opt-in: solo elementos con [data-sound-hover] lo
       disparan (sino sera demasiado en una landing con muchos links).
     - Pausa la musica cuando la tab se oculta (visibilitychange) y
       reanuda al volver.
   ============================================================================ */

import { useEffect, useRef } from "react";

const BG_VOLUME = 0.45;
const HOVER_VOLUME = 0.6;
const CLICK_VOLUME = 0.65;

/* Fade in/out al togglear: 250ms, 25 pasos (10ms cada uno). */
const FADE_MS = 250;
const FADE_STEPS = 25;

const SELECTOR_CLICK =
  'button, a, [role="button"], input[type="button"], input[type="submit"]';

export default function SoundController() {
  /* Refs en vez de state — la UI del controller es invisible y no
     queremos re-renderizar React en cada cambio de volumen. */
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const clickRef = useRef<HTMLAudioElement | null>(null);
  const hoverRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const fadeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    /* Creamos los 3 Audio en memoria.
       bg-music pesa ~3,5 MB y arranca en silencio: si se precarga, se baja
       entera ANTES de que el visitante vea la tienda (medido: 3.517 KB a los
       432 ms, compitiendo con el hero). Va con preload="none" — se descarga
       recien cuando el usuario prende el sonido, que es cuando hace falta.
       Los cortitos (click/hover, ~7 KB) si se precargan: tienen que sonar
       instantaneo al primer click y no pesan. */
    const bg = new Audio("/assets/audio/bg-music.mp3");
    const click = new Audio("/assets/audio/click.mp3");
    const hover = new Audio("/assets/audio/hover.mp3");
    bg.loop = true;
    bg.preload = "none";
    click.preload = "auto";
    hover.preload = "auto";
    bg.volume = 0;
    click.volume = 0;
    hover.volume = 0;
    bgRef.current = bg;
    clickRef.current = click;
    hoverRef.current = hover;

    /* Helper de fade lineal entre two volumes. Cancela el anterior. */
    const fade = (from: number, to: number, onDone?: () => void) => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      const stepMs = FADE_MS / FADE_STEPS;
      let i = 0;
      fadeIntervalRef.current = window.setInterval(() => {
        i++;
        const p = Math.min(i / FADE_STEPS, 1);
        const v = from + (to - from) * p;
        bg.volume = v * BG_VOLUME;
        click.volume = v * CLICK_VOLUME;
        hover.volume = v * HOVER_VOLUME;
        if (p >= 1) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          onDone?.();
        }
      }, stepMs);
    };

    const broadcast = () => {
      window.dispatchEvent(
        new CustomEvent("whynot:sound-state", {
          detail: { on: playingRef.current },
        }),
      );
    };

    const turnOn = () => {
      if (playingRef.current) return;
      playingRef.current = true;
      /* play() devuelve una Promise; si el browser la rechaza (autoplay
         policy en algunos casos) revertimos el estado. */
      const p = bg.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          playingRef.current = false;
          broadcast();
        });
      }
      fade(0, 1);
      broadcast();
    };

    const turnOff = () => {
      if (!playingRef.current) return;
      playingRef.current = false;
      fade(1, 0, () => bg.pause());
      broadcast();
    };

    const onToggle = () => {
      if (playingRef.current) turnOff();
      else turnOn();
    };

    /* Click sound: cualquier boton/link que no opta out con data-sound-skip.
       Usa currentTime=0 para que se pueda re-disparar rapido si el user
       clickea varias veces seguidas (sino se cortaria). Clonamos el audio
       en cada disparo para permitir overlap real. */
    const onClick = (e: MouseEvent) => {
      if (!playingRef.current) return;
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest(SELECTOR_CLICK) as HTMLElement | null;
      if (!el) return;
      if (el.hasAttribute("data-sound-skip")) return;
      /* clone para permitir solapamiento (si dos clicks rapidos). */
      const c = click.cloneNode(true) as HTMLAudioElement;
      c.volume = CLICK_VOLUME;
      c.play().catch(() => {});
    };

    /* Hover sound: solo elementos explicitamente marcados data-sound-hover.
       Lo marcamos con data-sound-playing para no re-disparar mientras el
       mouse este encima — se limpia en mouseleave. */
    const onMouseOver = (e: MouseEvent) => {
      if (!playingRef.current) return;
      const target = e.target as Element | null;
      if (!target) return;
      const el = target.closest("[data-sound-hover]") as HTMLElement | null;
      if (!el) return;
      if (el.hasAttribute("data-sound-playing")) return;
      el.setAttribute("data-sound-playing", "true");
      const h = hover.cloneNode(true) as HTMLAudioElement;
      h.volume = HOVER_VOLUME;
      h.play().catch(() => {});
      const cleanup = () => {
        el.removeAttribute("data-sound-playing");
        el.removeEventListener("mouseleave", cleanup);
      };
      el.addEventListener("mouseleave", cleanup, { once: true });
    };

    /* Pausa la musica si el user cambia de tab — ahorra bateria y evita
       seguir sonando en segundo plano. Al volver, retomamos. */
    const onVisibility = () => {
      if (!playingRef.current) return;
      if (document.hidden) {
        bg.pause();
      } else {
        bg.play().catch(() => {});
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("mouseover", onMouseOver);
    window.addEventListener("whynot:sound-toggle", onToggle);
    document.addEventListener("visibilitychange", onVisibility);

    /* Broadcast inicial: cuando el Header monta, recibe el estado actual. */
    broadcast();

    return () => {
      document.removeEventListener("click", onClick, { capture: true } as any);
      document.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("whynot:sound-toggle", onToggle);
      document.removeEventListener("visibilitychange", onVisibility);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      bg.pause();
      bg.src = "";
      click.src = "";
      hover.src = "";
    };
  }, []);

  return null;
}
