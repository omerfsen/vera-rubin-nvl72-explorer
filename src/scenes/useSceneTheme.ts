import { useExplorer } from '../state/store';
import { DIM_COLORS, LINK_HALO, LINK_THEME_COLORS, SCENE_THEMES, type SceneColors } from './geometry';

/** Scene colours, the off-network colour and the connection colours for the current theme. */
export function useSceneTheme(): { theme: 'light' | 'dark'; scene: SceneColors; dim: string; links: Record<string, string>; halo: string } {
  const theme = useExplorer((s) => s.theme);
  return { theme, scene: SCENE_THEMES[theme], dim: DIM_COLORS[theme], links: LINK_THEME_COLORS[theme], halo: LINK_HALO[theme] };
}
