export interface FileMatch {
  path: string;
  display: string;
}

export interface Command {
  name: string;
  description: string;
  handler: () => void;
}

export interface KeyEvent {
  ctrl?: boolean;
  meta?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  return?: boolean;
  tab?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
}
