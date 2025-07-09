import { body, validationResult } from 'express-validator';

export const validateUrl = [
  body('url')
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true 
    })
    .withMessage('Please provide a valid URL with http or https protocol'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];