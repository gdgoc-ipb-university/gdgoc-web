"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-provider";
import { PixelDino } from "./icons";
import type { SceneStatus } from "./campus-environment";

/** Releases on a rendered WebGL frame, or a settled static-image fallback. */
export function ScenePreloader({ status }: { status: SceneStatus }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { animated } = useExperience();
  const [finished, setFinished] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (finished) return;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Native modal behavior keeps the page out of the keyboard focus order.
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [finished]);

  useEffect(() => {
    if (status === "loading" || finished) return;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      setRevealing(true);
      timer = window.setTimeout(() => setFinished(true), animated ? 280 : 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [status, animated, finished]);

  if (finished) return null;
  return (
    <>
      <dialog
        ref={dialog}
        className={`scene-preloader${revealing ? " is-revealing" : ""}`}
        data-scene-preloader={revealing ? "revealing" : "loading"}
        aria-labelledby="preloader-heading"
        aria-describedby="preloader-status"
        onCancel={(event) => event.preventDefault()}
      >
        <div className="preloader-content">
          <div className="preloader-world" aria-hidden="true">
            <span className="preloader-sun" />
            <span className="preloader-cloud" />
            <PixelDino />
            <span className="preloader-ground" />
            <span className="preloader-sprout" />
          </div>
          <p className="eyebrow">GOOGLE DEVELOPER GROUP ON CAMPUS</p>
          <h2 id="preloader-heading">GDGoC <span>IPB</span></h2>
          <div className="preloader-blocks" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <p id="preloader-status" role="status" aria-live="polite">
            {status === "fallback" ? "Menyiapkan tampilan kampus" : "Menyiapkan kampus 3D"}
          </p>
        </div>
        <span className="preloader-caption">TEMPAT BELAJAR & BIKIN KARYA BARENG</span>
      </dialog>
      <noscript><style>{`.scene-preloader { display: none !important; }`}</style></noscript>
    </>
  );
}
