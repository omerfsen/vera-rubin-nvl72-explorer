import { useExplorer } from '../state/store';
import { DIM_COLORS, SCENE_THEMES, type SceneColors } from './geometry';

/** Scene colours and the off-network colour for the current theme. */
export function useSceneTheme(): { scene: SceneColors; dim: string } {
  const theme = useExplorer((s) => s.theme);
  return { scene: SCENE_THEMES[theme], dim: DIM_COLORS[theme] };
}
