const COLORS: Record<string, string> = {
  JavaScript: "#e8c35a",
  TypeScript: "#5b8fd8",
  HTML: "#e3765b",
  CSS: "#9b7fd9",
  SCSS: "#c97fa6",
  Python: "#4f86c6",
  Java: "#c98a4b",
  "C#": "#6fb07f",
  Go: "#5ec4d6",
  Shell: "#8fcf7a",
  PowerShell: "#5a8fd0",
  Vue: "#6fc49a",
  Dockerfile: "#7f9fb5",
  MDX: "#d0a35e",
};
export const langColor = (name: string) => COLORS[name] ?? "#c3a6b8";
