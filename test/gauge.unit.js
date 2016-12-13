const expect = require('chai').expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
require('sinon-as-promised')

const Gauge = require('../lib/gauge.js')
const Metric = require('../lib/metric.js')

describe('gauge', function () {
  beforeEach(function () {
    this.Metric = sinon.stub()
    this.Gauge = proxyquire('../lib/gauge.js', {
      './metric.js': this.Metric
    })
  })

  describe('constructor', function () {
    it('should create a gauge', function () {
      const monitor = {}
      const metricType = 'metricType'
      const opts = {}
      const gauge = new this.Gauge(monitor, metricType, opts)
      expect(gauge).to.be.an.instanceOf(this.Gauge)
      sinon.assert.calledOnce(this.Metric)
      sinon.assert.calledWith(this.Metric, monitor, 'GAUGE', metricType, opts)
    })
  })

  describe('report', function () {
    beforeEach(function () {
      this.project = 'project'
      this.authClient = {}
      this.res = {}
      this.client = {
        projects: {
          metricDescriptors: {
            create: sinon.stub(),
            delete: sinon.stub()
          },
          timeSeries: {
            create: sinon.stub()
          }
        }
      }
      this.resource = {}
      this.monitor = {
        getAuthClient: sinon.stub().resolves(this.authClient),
        getClient: sinon.stub().returns(this.client),
        getProject: sinon.stub().returns(this.project),
        getResource: sinon.stub().returns(this.resource)
      }
      this.opts = {
        description: 'description',
        displayName: 'displayName',
        labels: [{
          key: 'labelKey',
          valueType: 'INT64',
          description: 'labelDescription'
        }],
        metricDomain: 'metricDomain',
        unit: 'unit',
        valueType: 'INT64'
      }
      this.metricType = 'metricType'
      sinon.stub(Metric.prototype, 'report').resolves()
      this.gauge = new Gauge(this.monitor, this.metricType, this.opts)
    })
    afterEach(function () {
      Metric.prototype.report.restore()
    })

    it('should report a gauge metric (value, endTime, labels)', function () {
      const value = 1
      const endTime = new Date()
      const labels = {}
      return this.gauge.report(value, endTime, labels).then(function () {
        sinon.assert.calledOnce(Metric.prototype.report)
        sinon.assert.calledWith(Metric.prototype.report, value, { endTime: endTime }, labels)
      })
    })

    it('should report a gauge metric (value, endTime)', function () {
      const value = 1
      const endTime = new Date()
      return this.gauge.report(value, endTime).then(function () {
        sinon.assert.calledOnce(Metric.prototype.report)
        sinon.assert.calledWith(Metric.prototype.report, value, { endTime: endTime }, undefined)
      })
    })

    it('should report a gauge metric (value, labels)', function () {
      const value = 1
      const labels = {}
      return this.gauge.report(value, labels).then(function () {
        sinon.assert.calledOnce(Metric.prototype.report)
        sinon.assert.calledWith(Metric.prototype.report, value, { endTime: null }, labels)
      })
    })
  })
})
