const assert = require('assert')

const castArr = require('cast-array')
const defaults = require('101/defaults')
const exists = require('101/exists')
const pick = require('101/pick')
const google = require('googleapis')

const Gauge = require('./gauge.js')
const Cumulative = require('./cumulative.js')

const MONITORING_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/monitoring',
  'https://www.googleapis.com/auth/monitoring.read',
  'https://www.googleapis.com/auth/monitoring.write'
]

module.exports = Monitor

function Monitor (opts) {
  assert(opts, 'opts is required')
  assert(opts.project, 'project is required')
  this._authClient = null
  this._authJSON = opts.auth
  this._client = google.monitoring('v3')
  this._project = opts.project
  this._resource = opts.resource || {
    type: 'global'
  }
  assert(this._resource.type, 'resource.type is required')
}

/**
 * initialize google api client
 * @param  {Function} cb
 * @return {Promise} client
 */
Monitor.prototype.getAuthClient = function () {
  if (this._authClient) {
    // auth client already created
    return Promise.resolve(this._authClient)
  }
  if (this._authClientPromise) {
    // creating auth client
    return this._authClientPromise
  }
  // create and cache auth client
  const self = this
  const authJSON = this._authJSON
  this._authClientPromise = new Promise(function (resolve, reject) {
    if (authJSON) {
      google.auth.fromJSON(authJSON, callback)
    } else {
      google.auth.getApplicationDefault(callback)
    }
    function callback (err, authClient) {
      if (err) { return reject(err) }
      if (authClient.createScopedRequired && authClient.createScopedRequired()) {
        authClient = authClient.createScoped(MONITORING_SCOPES)
      }
      // set state
      self._authClient = authClient
      delete self._authClientPromise
      // resolve
      resolve(authClient)
    }
  })
  return this._authClientPromise
}

/**
 * get client
 * @return {Object} client
 */
Monitor.prototype.getClient = function () {
  return this._client
}

/**
 * get project object
 * @return {String} project
 */
Monitor.prototype.getProject = function () {
  return this._project
}

/**
 * get resource object
 * @return {Object} resource
 */
Monitor.prototype.getResource = function () {
  return this._resource
}

/**
 * create a gauge
 * @param  {String} metricType
 * @param  {Object} [opts] metric params
 * @param  {Object} [opts.metricDomain] default: 'custom.googleapis.com'
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: INT64
 * @return {Promise<Model,Error>} resolves Gauge instance
 */
Monitor.prototype.createGauge = function (metricType, opts) {
  const gauge = new Gauge(this, metricType, opts)
  // resolve gauge (not response)
  return gauge.create().then(function () {
    return gauge
  })
}

/**
 * create a cumulative
 * @param  {String} metricType
 * @param  {Object} [opts] metric params
 * @param  {Object} [opts.metricDomain] default: 'custom.googleapis.com'
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: INT64
 * @return {Promise<Model,Error>} resolves Cumulative instance
 */
Monitor.prototype.createCumulative = function (metricType, opts) {
  const cumulative = new Cumulative(this, metricType, opts)
  // resolve cumulative (not response)
  return cumulative.create().then(function () {
    return cumulative
  })
}
