export type TransformOptions = {
  filename?: string;
  markDomDirtyImport?: string;
  effectImportSources?: string[];
  bindings?: string[];
};

export type TransformResult = {
  code: string;
  map?: object;
};
