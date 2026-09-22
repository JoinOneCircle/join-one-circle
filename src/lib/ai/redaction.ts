const replacements: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL REDACTED]"],
  [/(?:\+44\s?\d{2,4}|0\d{2,4})[\s()-]*\d{3,4}[\s-]*\d{3,4}/g, "[PHONE REDACTED]"],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[POSTCODE REDACTED]"],
  [/\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g, "[IDENTIFIER REDACTED]"],
  [/\b(?:0?[1-9]|[12]\d|3[01])[\/.\-](?:0?[1-9]|1[0-2])[\/.\-](?:19|20)\d{2}\b/g, "[DATE REDACTED]"],
  [/\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g, "[DATE REDACTED]"],
  [/\b\d{1,4}\s+[A-Za-z][A-Za-z\s'-]{2,40}\s(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Way|Close|Drive|Dr|Court|Ct)\b/gi, "[ADDRESS REDACTED]"],
  [/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g, "[NAME REDACTED]"],
];

export function redactForAi(input: string, knownNames: string[] = []) {
  let text = input.slice(0, 18_000);
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  for (const name of knownNames.filter((item) => item.trim().length > 1)) {
    text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[CHILD]");
  }
  return text;
}
