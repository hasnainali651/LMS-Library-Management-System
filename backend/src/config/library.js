const getLibrarySettings = () => ({
  libraryName: process.env.LIBRARY_NAME || 'Library Management System',
  address: process.env.LIBRARY_ADDRESS || '',
  hours: process.env.LIBRARY_HOURS || '',
  contact: process.env.LIBRARY_CONTACT || '',
});

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const getLibraryEmailFooter = () => {
  const settings = getLibrarySettings();
  return `<footer style="font-family: Arial, sans-serif; padding: 16px; color: #64748b;">${
    Object.values(settings).filter(Boolean).map(escapeHtml).join('<br/>')
  }</footer>`;
};

const getLibraryMailFrom = () => process.env.MAIL_FROM || {
  name: getLibrarySettings().libraryName,
  address: process.env.MAIL_USER,
};

module.exports = { getLibrarySettings, getLibraryEmailFooter, getLibraryMailFrom };
