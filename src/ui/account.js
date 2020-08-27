import blessed from '@hp4k1h5/blessed'
import contrib from '@hp4k1h5/blessed-contrib'

import { graph } from '../ui/graph.js'
import { clear } from '../util/clear.js'
import { spin } from '../util/spin.js'

export function buildAccount(ws, options, data) {
  clear(ws, options)

  const empty = [
    '{red-fg}no iex account data, enter config val or env var IEX_SECRET_KEY{/}',
    '{red-fg}no alapaca account data{/}',
  ]

  let [iex, alpaca] = []
  if (!data) {
    ;[iex, alpaca] = empty
  } else {
    ;[iex, alpaca] = data
    if (!iex) iex = empty[0]
    if (!alpaca) alpaca = { account: empty[1], positions: empty[1] }
  }

  // options.box = ws.grid.set(...[6, 6, 6, 6], blessed.text, {
  options.box = ws.grid.set(...options.yxhw, blessed.text, {
    name: 'account',
    label: `[${options.id}  account ${
      options.pollMs ? ' .. polling ' + spin() : ''
    }]`,
    // inputs
    keys: false,
    // input is true for focus rotation
    input: true,
    mouse: false,
    scrollable: false,
    // styles
    tags: true,
    style: {
      focus: { border: { fg: '#fc5' } },
    },
  })

  // add focus listeners
  ws.setListeners(options)

  const width = Math.floor(options.box.width / 3) - 1
  const height = Math.floor(options.box.height / 2) - 1

  const graphHeight = Math.floor(12 / alpaca.portfolio.length)
  alpaca.portfolio.forEach((pg, i) => {
    const g = graph(ws, pg, pg.title, graphHeight * i, 5, graphHeight, 2)
    g.setFront()
  })

  const accountAlpaca = blessed.text({
    parent: options.box,
    name: 'alpaca account',
    label: 'alpaca account',
    // inputs
    mouse: true,
    scrollable: true,
    // styles
    top: height,
    left: width * 2,
    width,
    height,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#44bbee' },
    },
  })

  const positionsAlpaca = blessed.text({
    parent: options.box,
    name: 'positions',
    label: 'alpaca positions',
    // inputs
    mouse: true,
    scrollable: true,
    // styles
    width,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#44bbee' },
    },
  })

  // iex
  const iexBox = blessed.box({
    parent: options.box,
    name: 'iex',
    label: 'iex account',
    keys: false,
    // input is true for focus rotation
    input: true,
    mouse: false,
    scrollable: false,
    // styles
    tags: true,
    left: width * 2,
    height,
    width,
    border: { type: 'line' },
    style: {
      border: { fg: '#4be' },
    },
  })

  const headerIex = blessed.text({
    parent: iexBox,
    name: 'iex header',
    // styles
    tags: true,
  })

  const dailyUsageIex = contrib.sparkline({
    parent: iexBox,
    inputs: false,
    mouse: true,
    scrollable: true,
    // styles
    tags: true,
    top: 2,
    left: 2,
  })

  const keyUsage = contrib.gauge({
    // parent: iexBox, // see next comment
    label: 'key usage',
    inputs: false,
    // styles
    tags: true,
    top: 7,
    height: 4,
    width: width - 2,
  })

  const keyNames = blessed.text({
    parent: iexBox,
    // inputs
    keys: false,
    inputs: false,
    mouse: true,
    scrollable: true,
    // styles
    tags: true,
    top: 12,
    width: width - 2,
  })

  // set data with or without data
  if (!data || !iex.stats) {
    headerIex.setContent(iex)
  } else {
    headerIex.setContent(
      `  {#afb-fg}msg monthly{/}:${iex.stats.mu.toLocaleString()} ::  {#afb-fg}msg pay:{/}${iex.stats.payg.toLocaleString()}`,
    )
    const date = new Date()
    dailyUsageIex.setData(
      [`daily iex msg ${date.getMonth() + 1}/${date.getFullYear()}`],
      iex.dailyUsage,
    )

    // can't find reason why this is necessary in contrib
    iexBox.append(keyUsage)
    keyUsage.setStack(iex.keyUsage)
    keyNames.setContent(iex.keyUsage.map((k) => k.key).join('|'))
  }

  accountAlpaca.setContent(alpaca.account)
  positionsAlpaca.setContent(alpaca.positions)
}
