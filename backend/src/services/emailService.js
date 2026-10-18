const transporter = require('../config/mail');
const ApiError = require('../utils/ApiError');
const { getLibraryEmailFooter, getLibraryMailFrom } = require('../config/library');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const date = (value) => new Date(value).toLocaleString('en-GB', { timeZone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' });
const page = (title, name, body) => `<div style="font-family:Arial,sans-serif"><h2>${escapeHtml(title)}</h2><p>Hello ${escapeHtml(name)},</p>${body}</div>`;
const linkBody = (link, label) => {
  const url = new URL(link);
  if (!['http:', 'https:'].includes(url.protocol)) throw new ApiError(400, 'Invalid email link');
  return `<p><a href="${escapeHtml(url.href)}">${escapeHtml(label)}</a></p>`;
};

const sendEmail = async (to, subject, html, cc = null) => {
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new ApiError(503, 'SMTP delivery is not configured');
  }
  if (!to || !subject || typeof html !== 'string') throw new ApiError(400, 'Email recipient, subject and HTML are required');
  try {
    const result = await transporter.sendMail({
      from: getLibraryMailFrom(), to, subject,
      html: `${html}${getLibraryEmailFooter()}`,
      ...(cc ? { cc } : {}),
    });
    if (!result || !result.accepted?.length || result.rejected?.length) {
      throw new Error('SMTP did not accept all recipients');
    }
    return result;
  } catch (error) {
    throw new ApiError(502, 'SMTP delivery failed');
  }
};

const templates = {
  verifyEmail: (name, link) => page('Verify Your Library Account', name, linkBody(link, 'Verify email address')),
  resetPassword: (name, link) => page('Password Reset Request', name, `<p><strong>URGENCY NOTICE:</strong> this link expires in 30 minutes.</p>${linkBody(link, 'Reset password')}`),
  welcomeEmail: (name, memberId) => page('Welcome to the Library', name, `<p>Your Member ID is ${escapeHtml(memberId)}.</p>`),
  welcomeMemberWithCredentials: (name, memberId, email, password) => page('Welcome to the Library', name, `<p>Member ID: ${escapeHtml(memberId)}</p><p>Email: ${escapeHtml(email)}</p><p>Temporary password: ${escapeHtml(password)}</p><p>Change your password on first sign in.</p>`),
  accountLocked: (name, unlockTime) => page('Account Temporarily Locked', name, `<p>Your account was locked after 5 consecutive failed login attempts.</p><p>Access resumes at ${escapeHtml(date(unlockTime))}.</p>`),
  accountActivated: (name) => page('Account Reactivated', name, '<p>Your library account has been reactivated.</p>'),
  accountSuspended: (name, reason) => page('Account Suspended', name, `<p>Reason: ${escapeHtml(reason || 'Administrative review')}. Please contact the library.</p>`),
  reservationReady: (name, title, expiresAt) => page('Reserved Book Ready', name, `<p>"${escapeHtml(title)}" is ready for pickup until ${escapeHtml(date(expiresAt))}.</p>`),
  reservationExpired: (name, title) => page('Reservation Expired', name, `<p>The pickup window for "${escapeHtml(title)}" has expired.</p>`),
  dueReminder: (name, title, dueDate, daysLeft) => page('Due Date Reminder', name, `<p>"${escapeHtml(title)}" is due in ${escapeHtml(daysLeft)} days, on ${escapeHtml(date(dueDate))}.</p>`),
  overdueAlert: (name, title, dueDate, fineAmount) => page('Overdue Book Notice', name, `<p>"${escapeHtml(title)}" was due on ${escapeHtml(date(dueDate))}. Accrued fine: PKR ${escapeHtml(fineAmount ?? 0)}.</p>`),
  overdueEscalation: (name, title, daysOverdue, fineAmount) => page('Borrowing Privileges Blocked', name, `<p>"${escapeHtml(title)}" is ${escapeHtml(daysOverdue)} days overdue. Borrowing is blocked until qualifying loans are resolved. Accrued fine: PKR ${escapeHtml(fineAmount ?? 0)}.</p>`),
  fineAdded: (name, amount, balance, reason) => page('Fine Assessed', name, `<p>Amount: PKR ${escapeHtml(amount)}. Reason: ${escapeHtml(reason || 'Overdue loan')}. Balance: PKR ${escapeHtml(balance)}.</p>`),
  membershipExpiring: (name, daysLeft, expiryDate) => page('Membership Expiring', name, `<p>Your membership expires in ${escapeHtml(daysLeft)} days, on ${escapeHtml(date(expiryDate))}.</p>`),
  weeklyLibraryReport: (stats) => page('Weekly Library Report', 'Administrator', `<p>New members: ${escapeHtml(stats.newMembers)}. Issues: ${escapeHtml(stats.newIssues)}.</p><p>Fines collected: PKR ${escapeHtml(stats.finesCollected)}. Assessed: PKR ${escapeHtml(stats.totalFinesAssessed)}.</p><ul>${stats.topBooks.map((book) => `<li>${escapeHtml(book.title)}: ${escapeHtml(book.count)}</li>`).join('')}</ul>`),
};

module.exports = { sendEmail, templates, escapeHtml };
