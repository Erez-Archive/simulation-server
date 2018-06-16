module.exports = { // TODO: PAIRS and ROUTES should sync automatically and not manually
  PAIRS: [
    'BCNETH',
    'BCNBNB',
    'BNBETH',
    'STORMETH',
    'STORMBNB',
    'ZILETH',
    'ZILBNB',
    'ADAETH',
    'ADABNB',
    'XLMETH',
    'XLMBNB'
  ],
  ROUTES: Object.freeze([
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
        symbol: 'BNB/ETH'
      }, {
        order: 'buy',
        symbol: 'BCN/BNB'
      }, {
        order: 'sell',
        symbol: 'BCN/ETH'
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
        symbol: 'ADA/ETH'
      }, {
        order: 'sell',
        symbol: 'ADA/BNB'
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
        symbol: 'ADA/BNB'
      }, {
        order: 'sell',
        symbol: 'ADA/ETH'
      }
    ],
    [
      {
        order: 'buy',
        symbol: 'XLM/ETH'
      }, {
        order: 'sell',
        symbol: 'XLM/BNB'
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
        symbol: 'XLM/BNB'
      }, {
        order: 'sell',
        symbol: 'XLM/ETH'
      }
    ]
  ])
}
