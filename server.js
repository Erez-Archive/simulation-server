'use strict'
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

var corsOptions = {
  origin: /http:\/\/localhost:\d+/,
  credentials: true
}

const app = express()
const ccxt = require('ccxt')
app.use(cors(corsOptions))
app.use(bodyParser.json())

const PORT = 3010
// Kickup our server
const baseUrl = `http://localhost:${PORT}/data`
app.listen(PORT, function () {
  console.log(`Server is ready at ${baseUrl}`)
})

// Declare app variables
let exchangeList
let exchangesInstances
let tradeMarkets
let activeExchanges
let rateLimit
// Init basic data
const initData = () => {
  exchangeList = ccxt.exchanges
  exchangesInstances = exchangeList.map(exchangeName => {
    return {
      name: exchangeName,
      instance: new ccxt[exchangeName](),
      printRatesFunc: () => null
    }
  })
  activeExchanges = [
    { name: 'binance', instance: new ccxt.binance(), printRatesFunc: () => null, fees: {transaction: 0.001, withdrawal: 0.0015} },
    { name: 'bitfinex', instance: new ccxt.bitfinex2(), printRatesFunc: () => null, fees: {transaction: 0.002, withdrawal: 0.0015} },
    { name: 'bitsamp', instance: new ccxt.bitstamp(), printRatesFunc: () => null, fees: {transaction: 0.0025, withdrawal: 0} }
  ]
  activeExchanges.forEach(async exchange => {
    await exchange
      .instance
      .loadMarkets()

    })
  console.log('Finished mapping exchanges')
}

initData()

// Funcs

const getAllTickers = async market => {
  const tickers = []
  console.log('MARKET:', market)
  await activeExchanges.reduce(async (acc, exchange) => {
    console.log('PUSH?', acc)
    if (!Object.keys(exchange.instance.markets).includes(market)) return
    const fetchedData = await exchange.instance.fetchTicker(market)
    tickers.push({exchangeName: exchange.instance.name, fetchedData});
  }, [])
  console.log('tickers ready!')
  return tickers
}
const getOrderBooks = async market => {
  const books = []
  console.log('MARKET:', market)
  await activeExchanges.reduce(async (acc, exchange) => {
    if (!Object.keys(exchange.instance.markets).includes(market)) return
    const fetchedData = await exchange.instance.fetchOrderBook(market)
    books.push({exchangeName: exchange.instance.name, fetchedData});
  }, [])
  console.log('Order book ready!')
  return books
}

// GET options
app.get('/data/allTickers/:base/:quote', async (req, res) => {
  console.log('Got request for tickers for', req.params.base, '/', req.params.quote)
  const tickers = await getAllTickers(`${req.params.base}/${req.params.quote}`)
  console.log('sending tickers')
  console.log(tickers)
  res.json(tickers)
})
app.get('/data/orderBooks/:base/:quote', async (req, res) => {
  console.log('Got request for books of', req.params.base, '/', req.params.quote, 'at ', parseInt(Date.now() / 1000))
  const books = await getOrderBooks(`${req.params.base}/${req.params.quote}`)
  console.log('sending books')
  // console.log(books)
  res.json(books)
  // res.json('Sending at' + Date.now());
})
