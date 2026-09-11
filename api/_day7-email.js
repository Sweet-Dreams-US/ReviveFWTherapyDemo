const { ptOfferEmail } = require('./_pt-offer-email');
const day7Email = (email, activatedAt) => ptOfferEmail(email, activatedAt, true);
module.exports = { day7Email };
