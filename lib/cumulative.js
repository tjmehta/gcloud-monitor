const util = require('util')

const Metric = require('./metric.js')

module.exports = Cumulative

/**
 * cumulative metric
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
 * @return {Metric} cumulative instance
 */
function Cumulative (monitor, metricType, opts) {
  this._batchTimeSeriesMap = {}
  this._groupBy = opts.groupBy
  Metric.call(this, monitor, 'CUMULATIVE', metricType, opts)
}

util.inherits(Cumulative, Metric)

/**
 * create a cumulative metric
 * @return {Promise}
 */
Cumulative.prototype.create = function () {
  this._startTime = new Date()
  return Metric.prototype.create.apply(this, arguments)
}

/**
 * report a metric value
 * @param  {*} value
 * @param  {Object|Date} [interval|endTime|labels]
 * @param  {Object} [interval.startTime] default: last `interval.startTime` or `createCumulative` time
 * @param  {Object} [interval.endTime] default: new Date()
 * @param  {Object} [labels]
 * @return {Promise}
 */
Cumulative.prototype.report = function (value, interval, labels) {
  interval = interval || {}
  if (interval instanceof Date || typeof interval !== 'object') {
    interval = {
      endTime: interval
    }
  }
  if (arguments.length === 2 && !interval.startTime && !interval.endTime) {
    // (value, labels)
    labels = interval
    interval = {}
  }
  if (interval.startTime) {
    // cache startTime for subsequent requests
    this._startTime = interval.startTime
  } else {
    // use last start time
    interval.startTime = this._startTime
  }
  return Metric.prototype.report.call(this, value, interval, labels)
}

/*
 private methods
 */

Cumulative.prototype._batchBufferUpdate = function (oldTimeSeriesItem, newTimeSeriesItem) {
  const oldPoints = oldTimeSeriesItem.points
  const newPoints = newTimeSeriesItem.points
  // value object
  const valueType = this._opts.valueType
  const key = valueType.toLowerCase() + 'Value'
  const valueObj = {}
  valueObj[key] = (oldPoints.value[key] + newPoints.value[key])
  // update oldTimeSeriesItem
  oldTimeSeriesItem.points = {
    interval: newPoints.interval,
    value: valueObj
  }
}
