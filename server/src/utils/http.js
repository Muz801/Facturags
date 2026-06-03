// Envoltorio para controladores async: captura errores y los pasa a next()
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}
