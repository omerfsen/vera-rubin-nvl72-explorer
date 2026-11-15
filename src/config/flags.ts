/**
 * SHOW_OFFICIAL_FIGURES: hot-link NVIDIA's figures from docs.nvidia.com in
 * the side panel. Off by default while permission is pending. The images are
 * never copied into this repo or the build; they only load from NVIDIA's site.
 * Turn on at build time with VITE_SHOW_OFFICIAL_FIGURES=true.
 */
export const SHOW_OFFICIAL_FIGURES: boolean = import.meta.env.VITE_SHOW_OFFICIAL_FIGURES === 'true';

export const OFFICIAL_FIGURE_BASE = 'https://docs.nvidia.com/dgx/dgxvr-user-guide/_images/';

export function officialFigureUrl(fileName: string): string {
  return OFFICIAL_FIGURE_BASE + encodeURIComponent(fileName);
}
