import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(new ApiError(404, 'This address does not exist'));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their four arguments
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, fields: err.fields } });
  }

  if (err.code === 11000 && err.keyPattern?.email) {
    const message = 'This email is already registered';
    return res.status(409).json({ error: { message, fields: { email: message } } });
  }

  if (err.code === 11000 && err.keyPattern?.parentId) {
    const message = err.keyPattern.type
      ? 'A request for this parent is already waiting'
      : 'This parent already has a plan';
    return res.status(409).json({ error: { message } });
  }

  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Files must be 4 MB or smaller' : 'That upload did not work';
    return res.status(400).json({ error: { message } });
  }

  if (err.code === 11000 && err.keyPattern?.code) {
    const message = 'This code already exists';
    return res.status(409).json({ error: { message, fields: { code: message } } });
  }

  // A malformed id in the URL can't match anything.
  if (err.name === 'CastError') {
    return res.status(404).json({ error: { message: 'We could not find that' } });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'The request could not be read' } });
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.' } });
}
