import { ehErrorFromUnknown } from "../errors.js";

export function success(key: string, value: unknown) {
  const structuredContent = { [key]: value };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

export function successValue(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function toolError(error: unknown) {
  const typed = ehErrorFromUnknown(error);
  return {
    content: [{ type: "text" as const, text: typed.message }],
    structuredContent: { error: typed.toJSON() },
    isError: true as const,
  };
}
