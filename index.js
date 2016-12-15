const Monitor = require('./lib/monitor.js')

module.exports = monitorFactory

function monitorFactory (opts) {
  opts = opts
  return new Monitor(opts)
}
