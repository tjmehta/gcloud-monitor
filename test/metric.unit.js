const expect = require('chai').expect
const proxyquire = require('proxyquire')
const pick = require('101/pick')
const put = require('101/put')
const sinon = require('sinon')
require('sinon-as-promised')

const Metric = require('../lib/metric.js')

describe('metric', function () {
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
    this.metricKind = 'GAUGE'
    this.metricType = 'metricType'
    this.resourceName = ['projects/', this.project, '/metricDescriptors/', this.opts.metricDomain, '/', this.metricType].join('')
    this.metricName = [this.opts.metricDomain, '/', this.metricType].join('')
    this.projectName = ['projects/', this.project].join('')
  })

  describe('constructor', function () {
    describe('errors', function () {
      it('should error if monitor dne', function () {
        const self = this
        expect(function () {
          return new Metric(null, self.metricKind, self.metricType, self.opts)
        }).to.throw(/monitor is required/)
      })
      it('should error if metricKind dne', function () {
        const self = this
        expect(function () {
          return new Metric(self.monitor, null, self.metricType, self.opts)
        }).to.throw(/metricKind is required/)
      })
      it('should error if metricType dne', function () {
        const self = this
        expect(function () {
          return new Metric(self.monitor, self.metricKind, null, self.opts)
        }).to.throw(/metricType is required/)
      })
    })

    it('should create a metric', function () {
      const metric = new Metric(this.monitor, this.metricKind, this.metricType)
      const metric2 = new Metric(this.monitor, this.metricKind, this.metricType, this.opts)
      expect(metric).to.be.an.instanceof(Metric)
      expect(metric2).to.be.an.instanceof(Metric)
    })
  })

  describe('instance methods', function () {
    beforeEach(function () {
      this.metric = new Metric(this.monitor, this.metricKind, this.metricType, this.opts)
    })

    describe('create', function () {
      describe('error', function () {
        it('should error if metricDescriptors.create errors', function (done) {
          const self = this
          this.err = new Error()
          this.client.projects.metricDescriptors.create.yieldsAsync(this.err)
          this.metric.create()
            .then(function (res) {
              done(new Error('expected an err'))
            })
            .catch(function (err) {
              expect(err).to.equal(self.err)
              done()
            })
            .catch(done)
        })
      })

      it('should create a metric descriptor', function () {
        const self = this
        this.res = {}
        this.client.projects.metricDescriptors.create.yieldsAsync(null, this.res)
        return this.metric.create().then(function (res) {
          expect(res).to.equal(self.res)
          sinon.assert.calledOnce(self.monitor.getAuthClient)
          const create = self.client.projects.metricDescriptors.create
          sinon.assert.calledOnce(create)
          sinon.assert.calledWith(create, {
            auth: self.authClient,
            name: self.projectName,
            resource: put(pick(self.opts, [
              'description',
              'displayName',
              'labels',
              'unit',
              'valueType'
            ]), {
              name: self.resourceName,
              type: self.metricName,
              metricKind: self.metricKind
            })
          }, sinon.match.func)
        })
      })
    })

    describe('delete', function () {
      describe('error', function () {
        it('should error if metricDescriptors.delete errors', function (done) {
          const self = this
          this.err = new Error()
          this.client.projects.metricDescriptors.delete.yieldsAsync(this.err)
          this.metric.delete()
            .then(function (res) {
              done(new Error('expected an err'))
            })
            .catch(function (err) {
              expect(err).to.equal(self.err)
              done()
            })
            .catch(done)
        })
      })

      it('should delete a metric descriptor', function () {
        const self = this
        this.res = {}
        this.client.projects.metricDescriptors.delete.yieldsAsync(null, this.res)
        return this.metric.delete().then(function (res) {
          expect(res).to.equal(self.res)
          sinon.assert.calledOnce(self.monitor.getAuthClient)
          const del = self.client.projects.metricDescriptors.delete
          sinon.assert.calledOnce(del)
          sinon.assert.calledWith(del, {
            auth: self.authClient,
            name: self.resourceName
          }, sinon.match.func)
        })
      })
    })

    describe('formatTimeSeriesItem', function () {
      describe('errors', function () {
        it('should error if value dne', function () {
          const self = this
          expect(function () {
            self.metric.formatTimeSeriesItem()
          }).to.throw(/value is required/)
        })
      })

      it('should format a time series item', function () {
        this.params = undefined
        this.value = 1
        const timeSeriesItem = this.metric.formatTimeSeriesItem(this.value, this.params)
        expect(timeSeriesItem).to.deep.equal({
          metric: {
            type: this.metricName,
            labels: {}
          },
          resource: this.resource,
          metricKind: this.metricKind,
          valueType: this.opts.valueType,
          points: {
            interval: {},
            value: {
              int64Value: this.value
            }
          }
        })
      })
    })

    describe('report', function () {
      beforeEach(function () {
        this.date = new Date()
        sinon.stub(global, 'Date').returns(this.date)
      })
      afterEach(function () {
        global.Date.restore()
      })

      describe('errors', function () {
        it('should error if metricDescriptors.delete errors', function (done) {
          const self = this
          this.err = new Error()
          this.client.projects.timeSeries.create.yieldsAsync(this.err)
          this.metric.report(1)
            .then(function (res) {
              done(new Error('expected an err'))
            })
            .catch(function (err) {
              expect(err).to.equal(self.err)
              done()
            })
            .catch(done)
        })
      })

      it('should report time series data', function () {
        const self = this
        this.res = {}
        this.client.projects.timeSeries.create.yieldsAsync(null, this.res)
        this.value = 1
        return this.metric.report(this.value).then(function (res) {
          expect(res).to.equal(self.res)
          const create = self.client.projects.timeSeries.create
          sinon.assert.calledOnce(create)
          sinon.assert.calledWith(create, {
            auth: self.authClient,
            name: self.projectName,
            resource: {
              timeSeries: [{
                metric: {
                  type: self.metricName,
                  labels: {}
                },
                resource: self.resource,
                metricKind: self.metricKind,
                valueType: self.opts.valueType,
                points: {
                  interval: {
                    endTime: self.date
                  },
                  value: {
                    int64Value: self.value
                  }
                }
              }]
            }
          })
        })
      })

      it('should report time series data and interval', function () {
        const self = this
        this.res = {}
        this.client.projects.timeSeries.create.yieldsAsync(null, this.res)
        this.value = 1
        this.interval = {
          startTime: this.date,
          endTime: this.date
        }
        return this.metric.report(this.value, this.interval).then(function (res) {
          expect(res).to.equal(self.res)
          const create = self.client.projects.timeSeries.create
          sinon.assert.calledOnce(create)
          sinon.assert.calledWith(create, {
            auth: self.authClient,
            name: self.projectName,
            resource: {
              timeSeries: [{
                metric: {
                  type: self.metricName,
                  labels: {}
                },
                resource: self.resource,
                metricKind: self.metricKind,
                valueType: self.opts.valueType,
                points: {
                  interval: {
                    startTime: self.date,
                    endTime: self.date
                  },
                  value: {
                    int64Value: self.value
                  }
                }
              }]
            }
          })
        })
      })

      it('should report time series data, interval, and labels', function () {
        const self = this
        this.res = {}
        this.client.projects.timeSeries.create.yieldsAsync(null, this.res)
        this.value = 1
        this.interval = {
          startTime: this.date,
          endTime: this.date
        }
        this.labels = {
          labelKey: '1'
        }
        return this.metric.report(this.value, this.interval, this.labels).then(function (res) {
          expect(res).to.equal(self.res)
          const create = self.client.projects.timeSeries.create
          sinon.assert.calledOnce(create)
          sinon.assert.calledWith(create, {
            auth: self.authClient,
            name: self.projectName,
            resource: {
              timeSeries: [{
                metric: {
                  type: self.metricName,
                  labels: self.labels
                },
                resource: self.resource,
                metricKind: self.metricKind,
                valueType: self.opts.valueType,
                points: {
                  interval: {
                    startTime: self.date,
                    endTime: self.date
                  },
                  value: {
                    int64Value: self.value
                  }
                }
              }]
            }
          })
        })
      })
    })
  })
})
