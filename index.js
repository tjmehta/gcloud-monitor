const Monitor = require('./lib/monitor.js')

module.exports = monitorFactory

function monitorFactory (opts) {
  return new Monitor(opts)
}
