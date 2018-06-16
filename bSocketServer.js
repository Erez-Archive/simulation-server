const app = require('express');
const http = require('http').Server(app);
// Local client connection
const io = require('socket.io')(http);
// ----------------------------------- Trade consts
const CONSTS = require('./bConsts');
const overhead = require('./bOverheadData');
const initialETH = 0.012;
let activeTradeTimer = null;

// ----------------------------------- binance
const possibleTradeRoutes = require('./bTradeRoutes').ROUTES;
const marketData = {};
const marketsMinimums = {};
let lastUpdated = null;
let isTradeAllowed = false;
let isRunning = false;
let isPerformingArbitrage = false;

const binance = require('node-binance-api');
global.binance = binance;
const binanceDirect = require('./bDirectTrade');
binance.options({
  APIKEY: overhead.APIKEY, APISECRET: overhead.APISECRET, useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: false // If you want to use sandbox mode where orders are simulated
});

const connectToBinance = activeSocket => {
  binance
    .websockets
    .miniTicker(markets => {
      lastUpdated = Date.now();
      Object
        .keys(markets)
        .forEach(key => {
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
};

// ----------------------------

let clientsCount = 0;

// ----------------------------------- server code
const tradeUtils = require('./bTradeUtils');
const clientPort = 3000;
http.listen(clientPort, () => {
  console.log('Listening on port', clientPort);
});

io.on('connection', socket => {
  console.log('Client is connected');
  socket.emit('connection live');
  if (clientsCount === 0) {
    console.log('Opening connection to binance');
    clientsCount++;
    // connectToBinance(socket);
    binanceDirect.connectToBinance(socket, marketData);
    getMinimums();
  }
  socket.on('single trade', tradeData => {
    console.log('Received the following trade request:', tradeData);
    const flags = {type: 'MARKET', newOrderRespType: 'FULL'};
    if (tradeData.buyAmount) {
      const pair = (tradeData.buy + tradeData.sell).toUpperCase();
      const amount = tradeData.buyAmount;
      console.log('PAIR:', pair, 'Amount:', amount);
      binance.marketBuy(pair, amount, flags, (err, res) => {
      // binanceDirect.marketOrder('BUY', pair, amount, (err, res) => {
        socket.emit('single trade response', {res, err});
      });
    } else if (tradeData.sellAmount) {
      const pair = (tradeData.sell + tradeData.buy).toUpperCase();
      const amount = tradeData.sellAmount;
      console.log('PAIR:', pair, 'Amount:', amount);
      binance.marketSell(pair, amount, flags, (err, res) => {
      // binanceDirect.marketOrder('SELL', pair, amount, (err, res) => {
        socket.emit('single trade response', {res, err});
      });
    }
  });

  socket.on('arbitrage test', async() => {
    console.log('---------------------------RUNNING TEST-----------------');
    isRunning = true;
    isTradeAllowed = true;
    clearTimeout(activeTradeTimer);
    activeTradeTimer = setTimeout(() => {
      console.log('-------------------TEST OVER------------');
      isRunning = false;
    }, CONSTS.TEST_DURATION);
    while (isRunning) {
      possibleTradeRoutes.forEach(async orders => {
        const workOrders = orders.map(order => getPairData(order));
        // const currOrdersArbitrage = getArbitrage(workOrders, initialETH);
        const currOrdersArbitrage = getArbitrage(workOrders, initialETH);
        if (currOrdersArbitrage === -1) return; // Found none;
        console.log('RESULT:', currOrdersArbitrage);
        const resLength = currOrdersArbitrage.length;
        const calculatedRes = currOrdersArbitrage[resLength - 1].quantity / initialETH - 1;
        if (calculatedRes > CONSTS.MIN_ARBITRAGE_TO_TRADE) {
          console.log('Found AN ARBITRAGE OF:', (calculatedRes * 100).toFixed(2), '%');
          const ordersToExecute = createExecutionOrders(currOrdersArbitrage);
          if (!isPerformingArbitrage) {
            makeArbitrageTrade(ordersToExecute, socket);
            console.log('-------------------COOLING DOWN-------------------');
            await tradeUtils.coolDown(CONSTS.TRADE_COOLDOWN_DURATION_MILISECS);
            console.log('------------DONE COOLING DOWN------------------');
          }
        } else 
          console.log('CALC RESULT:', (calculatedRes * 100).toFixed(2), '%');
        }
      );
      await tradeUtils.coolDown(5000);
    }
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

function getPairData(order) {
  const seperatorIdx = order
    .symbol
    .indexOf('/');
  if (seperatorIdx === -1) 
    return {
      ...order,
      hasData: false
    };
  const pair = getFormattedPair(order.symbol, seperatorIdx);
  if (marketData[pair]) 
    return {
      ...order,
      currRate: marketData[pair].currRate,
      minOrderQuantity: marketsMinimums[pair].minQty,
      quantityPrecision: tradeUtils.getPrecision(marketsMinimums[pair].minQty),
      time: marketData[pair].time,
      hasData: true
    };
  
  return {
    ...order,
    hasData: false
  };
}

// minQty = minimum order quantity minNotional = minimum order value (price *
// quantity)
function getMinimums() { // TODO: move to bDirectTrade
  binance
    .exchangeInfo(function (error, data) {
      if (!data.symbols) 
        return;
      if (error) 
        console.log('Error getting minimums!');
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

// function getArbitrage(orders, initialAmount) {
//   // console.log('Checking arbitrage for order:', orders);
//   if (!orders.every(order => order.hasData)) 
//     return -1;
//   let quantity = initialAmount;
//   return orders.map(order => {
//     const preExecutionQuantity = quantity;
//     quantity = order.order === 'buy'
//       ? quantity / order.currRate
//       : quantity * order.currRate;
//     return {
//       ...order,
//       preExecutionQuantity,
//       preFeeQuantity: quantity,
//       quantity: quantity * (1 - CONSTS.FEE_PERCENT)
//     };
//   });
// }

const getArbitrage = (orders, initialAmount) => {

  let quantity = initialAmount;
  return orders.map(order => {
    const preExecutionQuantity = quantity;
    const seperatorIdx = order.symbol.indexOf('/');
    order.symbol = getFormattedPair(order.symbol, seperatorIdx);
    const newQuantity = calcQuantByBids(order, initialAmount);
    
    return {
      ...order,
      preExecutionQuantity,
      preFeeQuantity: quantity,
      quantity: quantity * (1 - CONSTS.FEE_PERCENT)
    };
  });
};

function calcQuantByBids(order) {
  let depth;
  if (order.order === 'buy') {
    depth = tradeUtils.sortDepthArr(Object.entries(marketData[order.symbol].asks), true);
    console.log('BUY DEPTH:', depth);
  } else if (order.order === 'sell') {
    depth = tradeUtils.sortDepthArr(Object.entries(marketData[order.symbol].asks));
    console.log('SELL DEPTH:', depth);

  }

}

function createExecutionOrders(analyzedArbitrageData) {
  return analyzedArbitrageData.map(order => {
    const seperatorIdx = order
      .symbol
      .indexOf('/');
    const precisionMultiplier = Math.pow(10, order.quantityPrecision);
    if (order.order === 'buy') 
      return {
        unformattedPair: order.symbol,
        pair: getFormattedPair(order.symbol, seperatorIdx),
        order: 'buy',
        quantity: Math.floor(order.preFeeQuantity * precisionMultiplier) / precisionMultiplier
      };
    else 
      return {
        unformattedPair: order.symbol,
        pair: getFormattedPair(order.symbol, seperatorIdx),
        order: 'sell',
        quantity: Math.floor(order.preExecutionQuantity * precisionMultiplier) / precisionMultiplier
      };
  });
};

function makeArbitrageTrade(orders, clientSocket) {
  console.log('---------------------------------PERFORMING TRADE');
  isPerformingArbitrage = true;
  console.log(orders);
  const order0 = orders[0];
  const orderType = order0.order === 'buy'
    ? 'marketBuy'
    : 'marketSell';
  if (isTradeOn) 
    binance[orderType](order0.pair, order0.quantity, (err, res) => {
      clientSocket.emit('single trade response', {res, err});
      if (err || res.statusCode > 200) {
        isTradeAllowed = false;
        return;
      }
      const order1 = fixRoundingErrors(orders[0], orders[1], res);
      const orderType = order1.order === 'buy'
        ? 'marketBuy'
        : 'marketSell';
      if (isTradeOn) 
        binance[orderType](order1.pair, order1.quantity, (err, res) => {
          clientSocket.emit('single trade response', {res, err});
          if (err || res.statusCode > 200) {
            isTradeAllowed = false;
            return;
          }
          const order2 = fixRoundingErrors(orders[1], orders[2], res);
          const orderType = order2.order === 'buy'
            ? 'marketBuy'
            : 'marketSell';
          if (isTradeOn) 
            binance[orderType](order2.pair, order2.quantity, (err, res) => {
              clientSocket.emit('single trade response', {res, err});
              if (err || res.statusCode > 200) {
                isTradeAllowed = false;
                return;
              }
              // isTradeAllowed = false;
              isPerformingArbitrage = false;
              // setTimeout(() => {   isTradeAllowed = true; }, 5000);
            });
          }
        );
      }
    );
  console.log('DONE!');
  console.log('-------------------------------------------------');
}

function fixRoundingErrors(executedOrder, nextOrder, actualRes) {
  if (executedOrder.order === 'buy' && nextOrder.order === 'sell' && nextOrder.quantity > actualRes.executedQty) {
    const currPrecision = tradeUtils.getNumOfDecimals(nextOrder.quantity);
    const precisionMultiplier = Math.pow(10, currPrecision);
    nextOrder.oldQuantity = nextOrder.quantity;
    nextOrder.quantity = Math.floor(actualRes.executedQty * precisionMultiplier) / precisionMultiplier;
  }
  // console.log('EXECUTED:', executedOrder); console.log('NEXT:', nextOrder);
  // console.log('ACTUAL:', actualRes);
  return nextOrder;
}

function isTradeOn() {
  return isTradeAllowed && (Date.now() - lastUpdated < CONSTS.NOW_TO_LAST_UPDATED_MAX_DIFF);
}
