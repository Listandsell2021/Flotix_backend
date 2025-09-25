const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
};

module.exports = {
  getClientIP,
};