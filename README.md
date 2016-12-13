# gcloud-monitor [![Build Status](https://travis-ci.org/tjmehta/gcloud-monitor.svg?branch=master)](https://travis-ci.org/tjmehta/gcloud-monitor) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
A node.js module for Custom monitoring using Google Cloud Monitoring v3 API

## Installation
```bash
npm i --save gcloud-monitor
```

## Usage

### Gauge

#### Create a Gauge Metric
```js
const monitor = require('gcloud-monitor')({
  project: '<google-cloud-project-name>',
  resource: {
    // optional, defaults to {type: 'global'}
    // more info: https://cloud.google.com/monitoring/api/ref_v3/rest/v3/MonitoredResource
  },
  auth: {
    // optional, if using on GCE
    // more info: https://github.com/google/google-api-nodejs-client#authorizing-and-authenticating
  },
  // optional: default report throttle time
  timeout: 1000
})

/**
 * create a gauge
 * more info: https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.metricDescriptors#MetricDescriptor
 * @param  {String} metricType
 * @param  {Object} [opts] metric params
 * @param  {Object} [opts.throttle] // report throttle time
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.metricDomain] default: 'custom.googleapis.com'
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: 'INT64'
 * @return {Promise<Gauge,Error>} resolves gauge instance
 */
monitor.createGauge('connections', {
  displayName: 'Connections',
  description: 'Active socket connection count',
  labels: [{
    key: 'foo',
    description: 'foo label description',
    valueType: 'INT64'
  }],
  unit: 'connections',
  valueType: 'INT64'
}).then((gauge) => {
  // use gauge...
})
```

#### Report Gauge Metric Data
```js
/**
 * report a metric value
 * @param  {*} value
 * @param  {Date} [time]
 * @param  {Object} [labels]
 * @return {Promise}
 */
gauge.report(1, new Date(), {
  foo: 1
}).then((data) => {
  console.log('Response data', data)
})
```

#### Delete a Gauge Metric
```js
/**
 * delete the cumulative metric
 * @return {Promise}
 */
gauge.delete().then(function (data) {
  console.log('Response data', data)
})
```

### Cumulative

#### Create a Cumulative Metric
```js
const monitor = require('gcloud-monitor')({
  project: '<google-cloud-project-name>',
  auth: {/*auth-json*/} // optional, if using on GCE
})

/**
 * create a cumulative metric
 * more info: https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.metricDescriptors#MetricDescriptor
 * @param  {String} metricType
 * @param  {Object} [opts] metric params
 * @param  {Object} [opts.description]
 * @param  {Object} [opts.displayName]
 * @param  {Object} [opts.labels] label descriptors
 * @param  {Object} [opts.metricDomain] default: 'custom.googleapis.com'
 * @param  {Object} [opts.unit]
 * @param  {Object} [opts.valueType] default: INT64
 * @return {Promise<Model,Error>} resolves Cumulative instance
 */
monitor.createCumulative('requestsPerSecond', {
  displayName: 'Requests per Second',
  description: 'Active socket connection count',
  labels: [{
    key: 'foo',
    description: 'foo label description',
    valueType: 'INT64'
  }],
  unit: 'req/s',
  valueType: 'INT64'
}).then((cumulative) => {
  // use cumulative...
})
```

#### Report Cumulative Metric Data
```js
/**
 * report a metric value
 * @param  {*} value
 * @param  {Object|Date} [interval|endTime]
 * @param  {Object} [interval.startTime] default: last `interval.startTime` or `createCumulative` time
 * @param  {Object} [interval.endTime]
 * @param  {Object} [labels]
 * @return {Promise}
 */
cumulative.report(1, {
  startTime: startTime,
  endTime: new Date()
}, {
  foo: 1
}).then((data) => {
  console.log('Response data', data)
})
```

#### Delete a Cumulative Metric
```js
/**
 * delete the cumulative metric
 * @return {Promise}
 */
cumulative.delete().then(function (data) {
  console.log('Response data', data)
})
```

#### Note about throttle
Throttle can be set globally as `gcloud-monitor` `opt` or on each individual "metric" as a factory `opt`. This option throttle metric reports to the interval specified in ms.

## License
MIT
