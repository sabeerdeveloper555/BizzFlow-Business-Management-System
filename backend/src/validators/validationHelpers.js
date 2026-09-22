export const isSingleString = (value) =>
  typeof value === "string" && !Array.isArray(value);
