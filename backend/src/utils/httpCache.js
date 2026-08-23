// Responses that carry one-time credentials must never be stored by browsers
// or intermediaries: the commit/provisioning response is the only place the
// plaintext temporary credential ever exists.
function setNoStoreHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

module.exports = {
  setNoStoreHeaders
};
