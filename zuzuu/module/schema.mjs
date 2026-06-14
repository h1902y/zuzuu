// zuzuu/module/schema.mjs — light, generic item validation for composed modules.
// schema = { kinds?: string[], required?: string[] }. Pure, fail-soft.
export function validateAgainstSchema(schema = {}, payload = {}) {
  const errors = [];
  const warnings = [];
  const kinds = Array.isArray(schema.kinds) ? schema.kinds : [];
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const k of required) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') errors.push(`missing required field '${k}'`);
  }
  if (kinds.length && payload.type && !kinds.includes(payload.type)) {
    errors.push(`type '${payload.type}' not in kinds [${kinds.join(', ')}]`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
