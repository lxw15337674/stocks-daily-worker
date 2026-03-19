"use client";

import { useEffect, useState } from "react";

type UseScrollSpyOptions = {
  offset?: number;
};

function resolveActiveSection(sectionIds: string[], offset: number): string {
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter((section): section is HTMLElement => section !== null);

  if (sections.length === 0) {
    return sectionIds[0] ?? "";
  }

  const currentScrollTop = window.scrollY + offset;
  let activeId = sections[0].id;

  for (const section of sections) {
    if (section.offsetTop <= currentScrollTop) {
      activeId = section.id;
      continue;
    }

    break;
  }

  const viewportBottom = window.scrollY + window.innerHeight;
  const pageBottom = document.documentElement.scrollHeight - 4;
  if (viewportBottom >= pageBottom) {
    return sections[sections.length - 1]?.id ?? activeId;
  }

  return activeId;
}

export function useScrollSpy(sectionIds: string[], options: UseScrollSpyOptions = {}): string {
  const offset = options.offset ?? 128;
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (sectionIds.length === 0) {
      setActiveId("");
      return;
    }

    let frameId = 0;

    const updateActiveId = () => {
      const nextActiveId = resolveActiveSection(sectionIds, offset);
      setActiveId((currentActiveId) => (currentActiveId === nextActiveId ? currentActiveId : nextActiveId));
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateActiveId();
      });
    };

    updateActiveId();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [offset, sectionIds]);

  return activeId;
}
