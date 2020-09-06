import { getPrices, getBook, getQuote } from '../../src/api/iex.js'
import { getPosition, submitClose, submitOrder } from '../../src/api/alpaca.js'

// alpha is a very basic mean-reversion trading algorithm. it will determine a
// valid trading ranges, and execute buy/sell orders when the stock is within
// those ranges. This bot has not been backtested or tested at all, and is
// probably not a suitable investment vehicle for you. It is meant as a
// demonstration and learning tool for users who wish to create their own
// trading algorithms.
//
// This bot is intended to be started and stopped from an iexcli repl, and does
// not do any checks to ensure the market is open and trading.
export async function alpha(ws, options) {
  if (!options.symbol) {
    ws.printLines(
      '{#fa1-fg}alpha{/} bot needs a symbol, provide one with $symbol',
    )
    return
  }

  // set up the print object
  const botOptions = {
    bot: 'alpha',
    symbol: options.symbol,
    side: '',
    pl: 0,
    plpc: 0,
    qty: 0,
    msg: '',
  }

  ws.printLines('{#afa-fg}alpha{/} bot, go')

  // this bot only trades one lot at a time. if it is invested it will try to
  // exit the position once it has gained or lost 1%.
  async function meanReversion() {
    let position
    // first check whether or not bot is invested in the stock
    ws.printLines(`{#afa-fg}alpha{/} bot, checking ${options.symbol} position`)

    try {
      position = await getPosition(options)
    } catch (e) {
      ws.printLines(`{#afa-fg}alpha{/} bot, no ${options.symbol} position`)
    }

    if (position) {
      // if the bot is up or down more than a percent in profit, close the position
      if (Math.abs(position.unrealized_intraday_plpc) > 0.01) {
        ws.printLines(
          `{#afa-fg}alpha{/} bot, pl% ${position.unrealized_intraday_plpc}. closing position`,
        )
        try {
          await submitClose(ws, options, position.symbol)
          ws.printLines(
            `{#afa-fg}alpha{/} bot, closed ${options.symbol} position`,
          )
        } catch (e) {
          ws.printLines(
            `{#afa-fg}alpha{/} bot, {red-fg}ERR{/} could not close ${options.symbol} position`,
          )
        }
      }

      // else print bot info and return
      botOptions.side = position.side
      botOptions.pl = position.unrealized_intraday_pl
      botOptions.percent = position.unrealized_intraday_plpc
      botOptions.qty = position.qty
      options.print(botOptions)

      return
    }

    // otherwise if the bot is not invested, it will query market data and look
    // for opportunities to invest when the stock price has deviated more than
    // 1% from the daily mean
    ws.printLines(
      `{#afa-fg}alpha{/} bot, getting ${options.time} price/vol data for ${options.symbol}`,
    )
    // get stocks daily bars
    let _prices = await getPrices(options)

    // accumulate stock data
    let { prices, avg, tot, hi, lo, vol } = _prices.reduce(
      (a, v) => {
        // strip nulls
        if (!v.close) return a

        a.prices.push(v)
        a.tot++
        a.avg += v.close
        a.vol += v.volume
        if (v.close > a.hi) a.hi = v.close
        if (v.close < a.lo) a.lo = v.close
        return a
      },
      { prices: [], avg: 0, tot: 0, hi: -Infinity, lo: Infinity, vol: 0 },
    )

    const quote = await getQuote(options)
    const last = quote.close

    // find average
    avg = avg / tot
    // find mean
    let mean = [...prices].sort((l, r) => {
      return l.close - r.close
    })
    mean = mean[Math.floor(mean.length / 2)].close
    const hiLoDiff = hi - lo
    const hiLoPer = ((hiLoDiff / last.close) * 100).toFixed(2)

    botOptions.msg = `over ${options.time}: mean: ${mean} avg: ${avg.toFixed(
      2,
    )} 
last: ${last} lo: ${lo} / hi: ${hi} |  hiLoDiff: ${hiLoDiff.toFixed(
      2,
    )} ${hiLoPer}% 
vol: ${vol.toLocaleString()}`

    // const book = await getBook(options)
    const meanDiff = quote.close - mean
    const meanDiffPer = meanDiff / mean
    let side = ''
    let qty = 1
    ws.printLines(
      `${options.symbol} @ ${quote.close} off ${(meanDiffPer * 100).toFixed(
        2,
      )}% from day mean`,
    )

    if (meanDiffPer > 0.01) {
      if (meanDiff > 0) {
        side = 'sell'
      } else {
        side = 'buy'
      }
      ws.printLines(`${side}ing ${qty} shr of ${options.symbol}`)

      let order = {
        symbol: options.symbol.toUpperCase(),
        side,
        qty,
        time_in_force: 'gtc',
        type: 'market',
      }

      await submitOrder(ws, options, order)

      botOptions.msg += JSON.stringify(order, null, 2)
    } else {
      ws.printLines(`${options.symbol} is too close to mean to trade`)
    }

    options.print(botOptions)
  }

  await meanReversion()
  // set interval
  const interval = setInterval(
    // wrapper function
    meanReversion,
    // 15 seconds
    15000,
  )

  // return interval back to iexcli
  return interval
}
