const axios = require('axios');
const orderUrl = 'https://api.binance.com/api/v3/order';
const overhead = require('./bOverheadData');

const data = {timeStamp: new Date().getTime()};
const query = Object.keys(data).reduce(function(acc, k) {
  acc.push(k + '=' + encodeURIComponent(data[k]));
  return acc;
}, []).join('&');
const signature = crypto.createHmac('sha256', overhead.APISECRET).update(query).digest('hex'); // set the HMAC hash header

const binanceDirect = {
  marketBuy: (symbol, quantity, flags = {type: 'MARKET'}) => {
    console.log('BUY');
  },
  marketSell: () => {
    console.log('Sell');
  }
};
