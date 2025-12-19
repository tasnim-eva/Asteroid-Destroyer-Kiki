
export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  type: 'asteroid' | 'dustCloud';
  color: string;
}

export interface Treat {
  id: number;
  x: number;
  y: number;
  size: number;
  collected: boolean;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

export interface Planet {
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  opacity: number;
}
