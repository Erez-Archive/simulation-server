// const axios = require('axios');
// const crypto = require('crypto');
// const orderUrl = 'https://api.binance.com/api/v3/order';
// const overhead = require('./bOverheadData');

// const signature = crypto.createHmac('sha256', overhead.APISECRET).digest('hex'); // set the HMAC hash header
// console.log(signature)

// const marketOrder = async(side, symbol, quantity) => {
//   const timestamp = new Date().getTime()
//   try {
//     return {err: null, res: await axios({
//       method: 'post',
//       url: orderUrl,
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'X-MBX-APIKEY': overhead.APIKEY
//       },
//       params: {signature, recvWindow: 4000, symbol, side, type: 'MARKET', quantity, newOrderRespType: 'FULL', timestamp }
//     })};
//   } catch (err) {
//     console.log('Error!', err);
//     console.log('SIDE:', side, 'SYMBOL:', symbol, 'QUANTITY:', quantity);
//     throw Error(err);
//   }
// };

const PAIRS = require('./bTradeRoutes').PAIRS;

const connectToBinance = (activeSocket, marketData) => {
  const instance = global.binance;
  PAIRS.forEach(pair => {
    instance.websockets.depthCache([pair], (symbol, depth) => {
      let bids = instance.sortBids(depth.bids);
      let asks = instance.sortAsks(depth.asks);
      marketData[pair] = {bids, asks, time: new Date().getTime()};
      activeSocket.broadcast.emit('mini tickers', marketData);
    });
  });
};

module.exports = {
  connectToBinance
  // marketOrder
};
