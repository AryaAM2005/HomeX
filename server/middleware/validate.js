import { ApiError } from '../utils/ApiError.js';

function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields = {};
  for (const issue of result.error.issues) {
    fields[issue.path.join('.')] ??= issue.message;
  }
  throw new ApiError(400, 'Please check the details you entered', fields);
}

export function validate(schema) {
  return (req, res, next) => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}

// Express 5 makes req.query read-only, so the parsed values get their own property.
export function validateQuery(schema) {
  return (req, res, next) => {
    req.validQuery = parseOrThrow(schema, req.query);
    next();
  };
}
