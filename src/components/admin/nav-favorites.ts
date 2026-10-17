"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ALL_NAV_ITEMS } from "@/lib/admin/nav";

/**
 * 즐겨찾기 메뉴 — 이 브라우저에만 저장(개인 편의 기능).
 * 저장소를 못 쓰는 환경(시크릿 창·차단)에서도 화면은 그대로 동작한다.
 */
const KEY = "npo.admin.nav.favorites";
const MAX = 8;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const valid = new Set(ALL_NAV_ITEMS.map((i) => i.href));
    cache = Array.isArray(raw) ? raw.filter((h): h is string => typeof h === "string" && valid.has(h)).slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 실패해도 이번 화면에서는 유지
  }
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];

export function useNavFavorites() {
  const favorites = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
  const toggle = useCallback((href: string) => {
    const cur = read();
    write(cur.includes(href) ? cur.filter((h) => h !== href) : [...cur, href].slice(-MAX));
  }, []);
  return { favorites, toggle, isFavorite: (href: string) => favorites.includes(href) };
}
