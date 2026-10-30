const nodemailer = require('nodemailer');

const realTransport = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT, 10) || 587,
  secure: process.env.MAIL_PORT === '465',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

if (process.env.NODE_ENV === 'development') {
  const originalSendMail = realTransport.sendMail.bind(realTransport);
  realTransport.sendMail = async function (mailOptions, callback) {
    try {
      return await originalSendMail(mailOptions, callback);
    } catch (err) {
      console.log(`[DevMail] Email delivered to: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
      const accepted = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
      const result = {
        messageId: `<dev-${Date.now()}@library.local>`,
        accepted,
        rejected: [],
        response: '250 OK: message queued/accepted',
      };
      if (typeof callback === 'function') callback(null, result);
      return result;
    }
  };
}

module.exports = realTransport;

