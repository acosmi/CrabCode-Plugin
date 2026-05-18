export type AutomationCategory =
  | "mcp"
  | "skill"
  | "hook"
  | "agent"
  | "plugin"
  | "workflow";

export type Confidence = "low" | "medium" | "high";

export type ProjectSignal = {
  id: string;
  label: string;
  confidence: Confidence;
  evidence: string[];
};

export type Recommendation = {
  id: string;
  category: AutomationCategory;
  title: string;
  why: string;
  install?: string;
  createAt?: string;
  configPath?: string;
  priority: number;
  evidence: string[];
  caveats?: string[];
};

export type ProjectProfile = {
  root: string;
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  testCommands: string[];
  buildCommands: string[];
  crabcodeFiles: string[];
  signals: ProjectSignal[];
};

export type AnalysisReport = {
  profile: ProjectProfile;
  recommendations: Recommendation[];
};

export type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  [key: string]: unknown;
};

export type PackageJsonFile = {
  path: string;
  json: PackageJson;
};

export type ProjectScan = {
  root: string;
  files: string[];
  directories: string[];
  packageJson?: PackageJson;
  packageJsonPath?: string;
  packageJsons: PackageJsonFile[];
  lockFiles: string[];
  cargoManifests: string[];
  crabcodeFiles: string[];
  ciFiles: string[];
  envFiles: string[];
  mcpJson: boolean;
};

export type DetectionResult = {
  languages?: string[];
  frameworks?: string[];
  packageManagers?: string[];
  testCommands?: string[];
  buildCommands?: string[];
  crabcodeFiles?: string[];
  signals?: ProjectSignal[];
};
