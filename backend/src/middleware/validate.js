const { validationResult } = require('express-validator');

/**
 * Validation wrapper middleware for express-validator
 * Returns 422 with structured field errors on failure.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return res.status(422).json({
      success: false,
      errors: formattedErrors,
    });
  }

  next();
};

module.exports = {
  validate,
};
