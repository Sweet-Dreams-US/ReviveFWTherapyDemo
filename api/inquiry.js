// Retired public inquiry intake. Cached forms fail clearly without saving or sending.
// Job applications use /api/apply; Meta pass leads use the separate sheet sync.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'This signup form has been retired. Visit /free-pass for the 7-day pass or /careers for job applications.'
  });
};
