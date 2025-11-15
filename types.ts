export interface FormData {
  idea: string;
  duration: number;
  mainCharacters: number;
  sideCharacters: number;
  style: string;
  language: string;
  scriptType: string;
}

export interface Character {
  name: string;
  description: string;
  type: 'Main' | 'Side';
  imagePrompt?: string;
}

export interface Scene {
  scene: number;
  prompt: string;
  characters: string[];
  dialogue?: string;
  narration?: string;
}

export interface GeneratedScript {
  characters: Character[];
  scenes: Scene[];
}