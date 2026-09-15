export type BuildPlan = {
  summary: string; requirements: string[]; pages: string[]; stack: string[]; database: string[]; apis: string[];
  tasks: Array<{ type: "WEB_APP" | "BACKEND" | "DATABASE" | "PROMPT" | "CODE" | "TEST" | "DEBUG"; title: string; description: string }>;
};
