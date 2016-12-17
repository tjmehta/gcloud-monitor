const util = require('util')

const Metric = require('./metric.js')

module.exports = Gauge

/**
 * gauge metric
 * @param {Monitor} monitor
 * @param {String} metricDomain
 * @param {String} metricType
 * @param {Object} opts
 * @param  {Object} [opts.groupBy]
 * @param  {Object} [opts.metricDomain]
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: INT64
 * @return {Metric} gauge instance
 */
function Gauge (monitor, metricType, opts) {
  Metric.call(this, monitor, 'GAUGE', metricType, opts)
}

util.inherits(Gauge, Metric)

/**
 * report a metric value
 * @param  {*} value
 * @param  {Date|Object} [endTime|labels] default: new Date()
 * @param  {Object} [labels]
 * @return {Promise}
 */
Gauge.prototype.report = function (value, endTime, labels) {
  if (arguments.length === 2 && typeof endTime === 'object' && !(endTime instanceof Date)) {
    // (value, labels)
    labels = endTime
    endTime = null
  }
  return Metric.prototype.report.call(this, value, { endTime: endTime }, labels)
}

/*
 private methods
 */

Gauge.prototype._batchBufferUpdate = function (oldTimeSeriesItem, newTimeSeriesItem) {
  oldTimeSeriesItem.points = newTimeSeriesItem.points
}
