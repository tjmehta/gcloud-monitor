const expect = require('chai').expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
require('sinon-as-promised')

const Cumulative = require('../lib/cumulative.js')
const Metric = require('../lib/metric.js')

describe('cumulative', function () {
  beforeEach(function () {
    this.Metric = sinon.stub()
    this.Cumulative = proxyquire('../lib/cumulative.js', {
      './metric.js': this.Metric
    })
  })

  describe('constructor', function () {
    it('should create a cumulative', function () {
      const monitor = {}
      const metricType = 'metricType'
      const opts = {}
      const cumulative = new this.Cumulative(monitor, metricType, opts)
      expect(cumulative).to.be.an.instanceOf(this.Cumulative)
      sinon.assert.calledOnce(this.Metric)
      sinon.assert.calledWith(this.Metric, monitor, 'CUMULATIVE', metricType, opts)
    })
  })

  describe('instance methods', function () {
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
        getResource: sinon.stub().returns(this.resource),
        getDefaultThrottle: sinon.stub(),
        on: sinon.stub()
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
      this.cumulative = new Cumulative(this.monitor, this.metricType, this.opts)
      sinon.stub(Metric.prototype, 'create').resolves()
      sinon.stub(Metric.prototype, 'report').resolves()
    })
    afterEach(function () {
      Metric.prototype.create.restore()
      Metric.prototype.report.restore()
    })

    describe('create', function () {
      it('should create a cumulative metric', function () {
        const self = this
        return this.cumulative.create().then(function () {
          sinon.assert.calledOnce(Metric.prototype.create)
          sinon.assert.calledWith(Metric.prototype.create)
          expect(self.cumulative)
        })
      })

      describe('report after create', function () {
        beforeEach(function () {
          this.date = new Date()
          sinon.stub(global, 'Date').returns(this.date)
          return this.cumulative.create()
        })
        afterEach(function () {
          global.Date.restore()
        })

        it('should report a cumulative metric (value, {startDate: <createDate>})', function () {
          const self = this
          const value = 1
          return this.cumulative.report(value).then(function () {
            sinon.assert.calledOnce(Metric.prototype.report)
            sinon.assert.calledWith(Metric.prototype.report, value, { startTime: self.date })
          })
        })
      })
    })

    describe('report', function () {
      it('should report a cumulative metric (value)', function () {
        const value = 1
        return this.cumulative.report(value).then(function () {
          sinon.assert.calledOnce(Metric.prototype.report)
          sinon.assert.calledWith(Metric.prototype.report, value, { startTime: undefined })
        })
      })

      it('should report a cumulative metric (value, interval)', function () {
        const value = 1
        const interval = {
          startTime: new Date(),
          endTime: new Date()
        }
        return this.cumulative.report(value, interval).then(function () {
          sinon.assert.calledOnce(Metric.prototype.report)
          sinon.assert.calledWith(Metric.prototype.report, value, interval)
        })
      })

      it('should report a cumulative metric (value, endTime)', function () {
        const value = 1
        const endTime = new Date()
        return this.cumulative.report(value, endTime).then(function () {
          sinon.assert.calledOnce(Metric.prototype.report)
          sinon.assert.calledWith(Metric.prototype.report, value, { startTime: undefined, endTime: endTime })
        })
      })

      it('should report a cumulative metric (value, labels)', function () {
        const value = 1
        const labels = {}
        return this.cumulative.report(value, labels).then(function () {
          sinon.assert.calledOnce(Metric.prototype.report)
          sinon.assert.calledWith(Metric.prototype.report, value, { startTime: undefined }, labels)
        })
      })

      it('should report a cumulative metric (value, interval, labels)', function () {
        const value = 1
        const interval = {}
        const labels = {}
        return this.cumulative.report(value, interval, labels).then(function () {
          sinon.assert.calledOnce(Metric.prototype.report)
          sinon.assert.calledWith(Metric.prototype.report, value, interval, labels)
        })
      })
    })
  })
})
