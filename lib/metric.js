const assert = require('assert')

const assign = require('101/assign')
const defaults = require('101/defaults')
const exists = require('101/exists')
const pick = require('101/pick')
const timeout = require('timeout-then')

const CUSTOM_METRIC_DOMAIN = 'custom.googleapis.com'

module.exports = Metric

/**
 * metric
 * @param {Monitor} monitor
 * @param {String} metricKind
 * @param {String} metricType
 * @param {Object} [opts]
 * @param  {Object} [opts.throttle] throttle interval
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.metricDomain] default: 'custom.googleapis.com'
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: INT64
 * @return {Metric} metric instance
 */
function Metric (monitor, metricKind, metricType, opts) {
  assert(monitor, 'monitor is required')
  assert(metricKind, 'metricKind is required')
  assert(metricType, 'metricType is required')
  // state
  this._batchBufferReset()
  // defaults
  opts = opts || {}
  // args
  this._monitor = monitor
  this._metricKind = metricKind
  this._metricType = metricType
  this._metricDomain = opts.metricDomain || CUSTOM_METRIC_DOMAIN
  this._throttle = opts.throttle || this._monitor.getDefaultThrottle()
  // monitor props
  this._resource = monitor.getResource()
  this._projectName = ['projects/', monitor.getProject()].join('')
  this._metricName = [this._metricDomain, '/', this._metricType].join('')
  this._resourceName = [this._projectName, '/metricDescriptors/', this._metricName].join('')
  // opts
  this._opts = pick(opts, [
    'description',
    'displayName',
    'labels',
    'unit',
    'valueType'
  ])
  defaults(this._opts, {
    valueType: 'INT64'
  })
  assign(this._opts, {
    name: this._resourceName,
    type: this._metricName,
    metricKind: metricKind
  })
  // events
  this._monitor.on('clearTimers', this.clearTimers.bind(this))
}

Metric.CUSTOM_METRIC_DOMAIN = CUSTOM_METRIC_DOMAIN

/**
 * create this metric
 * @return {Promise}
 */
Metric.prototype.create = function () {
  const client = this._monitor.getClient()
  const self = this
  return this._monitor.getAuthClient().then(function (authClient) {
    return new Promise(function (resolve, reject) {
      client.projects.metricDescriptors.create({
        auth: authClient,
        name: self._projectName,
        resource: self._opts
      }, function (err, res) {
        if (err) { return reject(err) }
        resolve(res)
      })
    })
  })
}

/**
 * delete this metric
 * @return {Promise}
 */
Metric.prototype.delete = function () {
  const client = this._monitor.getClient()
  const self = this
  return this._monitor.getAuthClient().then(function (authClient) {
    return new Promise(function (resolve, reject) {
      client.projects.metricDescriptors.delete({
        auth: authClient,
        name: self._resourceName
      }, function (err, res) {
        if (err) { return reject(err) }
        resolve(res)
      })
    })
  })
}

/**
 * format time series item data
 * @param  {*}      value      gauge value
 * @param  {object} [params]   optional metric values
 * @param  {object} [params.interval]    metric labels, default: {}
 * @param  {object} [params.labels]    metric labels, default: {}
 * @return {Promise}
 */
Metric.prototype.formatTimeSeriesItem = function (value, params) {
  assert(exists(value), 'value is required')
  // defaults
  params = params || {}
  defaults(params, {
    interval: {},
    labels: {}
  })
  const valueType = this._opts.valueType
  // return data
  const valueObj = {}
  const key = valueType.toLowerCase() + 'Value'
  valueObj[key] = value
  return {
    metric: {
      type: this._metricName,
      labels: params.labels
    },
    resource: this._resource,
    metricKind: this._metricKind,
    valueType: valueType,
    points: {
      interval: params.interval,
      value: valueObj
    }
  }
}

/**
 * report a metric value
 * @param  {*} value
 * @param  {Object} [interval]
 * @param  {Object} [interval.startTime]
 * @param  {Object} [interval.endTime] default: new Date()
 * @param  {Object} [labels]
 * @return {Promise}
 */
Metric.prototype.report = function (value, interval, labels) {
  assert(exists(value), 'value is required')
  const opts = assign({}, this._opts, {
    interval: interval,
    labels: labels
  })
  // report
  interval = interval || {}
  interval.endTime = interval.endTime || new Date()
  const timeSeriesItem = this.formatTimeSeriesItem(value, {
    interval: interval,
    labels: labels
  })
  if (this._throttle) {
    return this._queueTimeSeriesItem(timeSeriesItem)
  } else {
    return this._createTimeSeries([timeSeriesItem])
  }
}

/**
 * clear timers
 * @return {Object} client
 */
Metric.prototype.clearTimers = function () {
  if (this._batchTimeout) {
    this._batchTimeout.clear()
  }
}

/*
  Private Methods
 */

Metric.prototype._batchBufferGroupKey = function (timeSeriesItem) {
  return this._groupBy
    ? this._groupBy(timeSeriesItem)
    : 'defaultGroup'
}
Metric.prototype._batchBufferPush = function (timeSeriesItem) {
  const groupKey = this._batchBufferGroupKey(timeSeriesItem)
  const oldTimeSeriesItem = this._batchTimeSeriesItemMap[groupKey]
  if (oldTimeSeriesItem) {
    this._batchBufferUpdate(oldTimeSeriesItem, timeSeriesItem)
  } else {
    this._batchTimeSeriesItemMap[groupKey] = timeSeriesItem
    this._batchTimeSeries.push(timeSeriesItem)
  }
}
Metric.prototype._batchBufferReset = function () {
  this._batchTimeSeriesItemMap = {}
  this._batchTimeSeries = []
  this._batchPromise = null
}

Metric.prototype._createTimeSeries = function (timeSeries) {
  const self = this
  return this._monitor.getAuthClient().then(function (authClient) {
    const req = {
      auth: authClient,
      name: self._projectName,
      resource: {
        timeSeries: timeSeries
      }
    }
    return new Promise(function (resolve, reject) {
      const client = self._monitor.getClient()
      client.projects.timeSeries.create(req, function (err, res) {
        if (err) { return reject(err) }
        resolve(res)
      })
    })
  })
}

Metric.prototype._queueTimeSeriesItem = function (timeSeriesItem) {
  const self = this
  this._batchBufferPush(timeSeriesItem)
  if (this._batchPromise) {
    // return batch promise
    return this._batchPromise
  }
  // batch timeout does not`` exist
  // create batch promise
  this._batchTimeout = timeout(this._throttle)
  this._batchPromise = this._batchTimeout.then(function () {
    const timeSeries = self._batchTimeSeries
    // reset batch state
    self._batchBufferReset()
    // create it
    return self._createTimeSeries(timeSeries)
  })
  // return create throttled
  return this._batchPromise
}
