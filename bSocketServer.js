const app = require('express');
const http = require('http').Server(app);

// Local client connection
const io = require('socket.io')(http);

// ----------------------------------- binance
const marketData = {};
const marketsMinimums = {};
let lastUpdated = null;
let isTradeAllowed = true;
let isErrorStop = false;
let isBackoffStop = false;
let isPerformingArbitrage = false;
const possibleTradeRoutes = [
  [
    {
      order: 'buy',
      symbol: 'BCN/ETH'
    }, {
      order: 'sell',
      symbol: 'BCN/BNB'
    }, {
      order: 'sell',
      symbol: 'BNB/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'BNB/ETH',
    }, {
      order: 'buy',
      symbol: 'BCN/BNB',
    }, {
      order: 'sell',
      symbol: 'BCN/ETH',
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'STORM/ETH'
    }, {
      order: 'sell',
      symbol: 'STORM/BNB'
    }, {
      order: 'sell',
      symbol: 'BNB/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'BNB/ETH'
    }, {
      order: 'buy',
      symbol: 'STORM/BNB'
    }, {
      order: 'sell',
      symbol: 'STORM/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'ZIL/ETH'
    }, {
      order: 'sell',
      symbol: 'ZIL/BNB'
    }, {
      order: 'sell',
      symbol: 'BNB/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'BNB/ETH'
    }, {
      order: 'buy',
      symbol: 'ZIL/BNB'
    }, {
      order: 'sell',
      symbol: 'ZIL/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'LTC/ETH'
    }, {
      order: 'sell',
      symbol: 'LTC/BNB'
    }, {
      order: 'sell',
      symbol: 'BNB/ETH'
    }
  ],
  [
    {
      order: 'buy',
      symbol: 'BNB/ETH'
    }, {
      order: 'buy',
      symbol: 'LTC/BNB'
    }, {
      order: 'sell',
      symbol: 'LTC/ETH'
    }
  ]
]

const FEE_PERCENT = 0.001;
const MIN_ARBITRAGE_TO_TRADE = 0.004;
const TRADE_COOLDOWN_DURATION_MILISECS = 10000;
const initialETH = 0.012;

const binance = require('node-binance-api');
global.binance = binance;
binance.options({
  test: false // If you want to use sandbox mode where orders are simulated
});

const connectToBinance = activeSocket => {
  binance.websockets.miniTicker(markets => {
    lastUpdated = Date.now();
    Object.keys(markets).forEach(key => {
      marketData[key] = {
        currRate: markets[key].close,
        time: markets[key].eventTime
      };
    });
    // activeSocket.broadcast.emit('mini tickers', marketData);
  });
};

const disconnectFromBinance = () => {
  console.log('Disconnecting!');
}

// ----------------------------

let clientsCount = 0;

io.on('connection', socket => {
  console.log('Client is connected');
  socket.emit('connection live');
  if (clientsCount === 0) {
    console.log('Opening connection to binance');
    clientsCount++;
    connectToBinance(socket);
    getMinimums();
  }
  socket.on('single trade', tradeData => {
    console.log('Received the following trade request:', tradeData);
    if (tradeData.buyAmount) {
      const pair = (tradeData.buy + tradeData.sell).toUpperCase();
      const amount = tradeData.buyAmount;
      console.log('PAIR:', pair, 'Amount:', amount);
      binance.marketBuy(pair, amount, (err, res) => {
        socket.emit('single trade response', {res, err});
      });
    } else if (tradeData.sellAmount) {
      const pair = (tradeData.sell + tradeData.buy).toUpperCase();
      const amount = tradeData.sellAmount;
      console.log('PAIR:', pair, 'Amount:', amount);
      binance.marketSell(pair, amount, (err, res) => {
        socket.emit('single trade response', {res, err})
      });
    }
  })

  socket.on('arbitrage test', () => {
    console.log('---------------------------RUNNING TEST-----------------');
    possibleTradeRoutes.forEach(orders => {
      const workOrders = orders.map(order => getPairData(order));
      const currOrdersArbitrage = getArbitrage(workOrders, initialETH);
      if (currOrdersArbitrage === -1) return; // Found none;
      console.log('RESULT:', currOrdersArbitrage);
      const resLength = currOrdersArbitrage.length;
      const calculatedRes = currOrdersArbitrage[resLength - 1].quantity / initialETH - 1;
      if (calculatedRes > MIN_ARBITRAGE_TO_TRADE) {
        console.log('Found AN ARBITRAGE OF:', (calculatedRes * 100).toFixed(2), '%');
        const ordersToExecute = createExecutionOrders(currOrdersArbitrage);
        if (!isPerformingArbitrage) makeArbitrageTrade(ordersToExecute, socket);
      } else console.log('CALC RESULT:', (calculatedRes * 100).toFixed(2), '%');
    });
  });

  socket.on('disconnect', socket => {
    console.log('Client is disconnected');
    clientsCount--;
    if (clientsCount === 0) {
      console.log('Last client disconnected, closing binance connection');
      disconnectFromBinance();
    }
  })
})

const clientPort = 3000;
http.listen(clientPort, () => {
  console.log('Listening on port', clientPort);
});

function getPairData(order) {
  const seperatorIdx = order.symbol.indexOf('/');
  if (seperatorIdx === -1) return {...order, hasData: false};
  const pair = getFormattedPair(order.symbol, seperatorIdx);
  if (marketData[pair]) return {...order, currRate: marketData[pair].currRate, minOrderQuantity: marketsMinimums[pair].minQty, quantityPrecision: getPrecision(marketsMinimums[pair].minQty), time: marketData[pair].time, hasData: true};

  return {...order, hasData: false};
}

// minQty = minimum order quantity minNotional = minimum order value (price *
// quantity)
function getMinimums() {
  binance
    .exchangeInfo(function(error, data) {
      if (!data.symbols) return;
      if (error) console.log('Error getting minimums!');
      for (let obj of data.symbols) {
        let filters = {
          status: obj.status
        };
        for (let filter of obj.filters) {
          if (filter.filterType === 'MIN_NOTIONAL') {
            filters.minNotional = filter.minNotional;
          } else if (filter.filterType === 'PRICE_FILTER') {
            filters.minPrice = filter.minPrice;
            filters.maxPrice = filter.maxPrice;
            filters.tickSize = filter.tickSize;
          } else if (filter.filterType === 'LOT_SIZE') {
            filters.stepSize = filter.stepSize;
            filters.minQty = filter.minQty;
            filters.maxQty = filter.maxQty;
          }
        }
        // filters.baseAssetPrecision = obj.baseAssetPrecision;
        // filters.quoteAssetPrecision = obj.quoteAssetPrecision;
        filters.orderTypes = obj.orderTypes;
        filters.icebergAllowed = obj.icebergAllowed;
        marketsMinimums[obj.symbol] = filters;
      }
    });
}
function getFormattedPair(symbol, seperatorIdx) {
  return symbol.slice(0, seperatorIdx) + symbol.slice(seperatorIdx + 1);
}

function getArbitrage(orders, initialAmount) {
  console.log('Checking arbitrage for order:', orders);
  if (!orders.every(order => order.hasData)) return -1;
  let quantity = initialAmount;
  return orders.map(order => {
    const preExecutionQuantity = quantity;
    quantity = order.order === 'buy' ? quantity / order.currRate : quantity * order.currRate;
    return {...order, preExecutionQuantity, preFeeQuantity: quantity, quantity: quantity * (1 - FEE_PERCENT)};
  });
}

function createExecutionOrders(analyzedArbitrageData) {
  return analyzedArbitrageData.map(order => {
    const seperatorIdx = order.symbol.indexOf('/');
    const precisionMultiplier = Math.pow(10, order.quantityPrecision);
    if (order.order === 'buy') return {pair: getFormattedPair(order.symbol, seperatorIdx), order: 'buy', quantity: Math.floor(order.preFeeQuantity * precisionMultiplier) / precisionMultiplier};
    else                       return {pair: getFormattedPair(order.symbol, seperatorIdx), order: 'sell', quantity: Math.floor(order.preExecutionQuantity * precisionMultiplier) / precisionMultiplier};
  });
};

function makeArbitrageTrade(orders, clientSocket) {
  console.log('---------------------------------PERFORMING TRADE');
  isPerformingArbitrage = true;
  console.log(orders);
  const order0 = orders[0];
  const orderType = order0.order === 'buy' ? 'marketBuy' : 'marketSell';
  if (isTradeOn) binance[orderType](order0.pair, order0.quantity, (err, res) => {
    clientSocket.emit('single trade response', {res, err});
    if (err || res.statusCode >= 300) return;
    const order1 = orders[1];
    const orderType = order1.order === 'buy' ? 'marketBuy' : 'marketSell';
    if (isTradeOn) binance[orderType](order1.pair, order1.quantity, (err, res) => {
      clientSocket.emit('single trade response', {res, err});
      if (err || res.statusCode >= 300) return;
      const order2 = orders[2];
      const orderType = order2.order === 'buy' ? 'marketBuy' : 'marketSell';    
      if (isTradeOn) binance[orderType](order2.pair, order2.quantity, (err, res) => {
        clientSocket.emit('single trade response', {res, err});
        isTradeAllowed = false;
        isPerformingArbitrage = false;
        setTimeout(() => {
          isTradeAllowed = true;
        }, 5000);
      });
    });
  });
  console.log('DONE!');
  console.log('-------------------------------------------------');
}

function isTradeOn() {
  return isTradeAllowed && !isErrorStop && !isBackoffStop;
}

function getPrecision(num) {
  let count = 0;
  while (num < 1) {
    num = num * 10;
    count++;
  }
  return count;
}

function toFixed(amount, numOfDecimals) {
  var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (numOfDecimals || -1) + '})?');
  return amount.toString().match(re)[0];
}
