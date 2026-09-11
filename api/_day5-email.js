const { ptOfferEmail } = require('./_pt-offer-email');
const day5Email = (email, activatedAt) => ptOfferEmail(email, activatedAt, false);
module.exports = { day5Email };
