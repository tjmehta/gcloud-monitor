const expect = require('chai').expect
const google = require('googleapis')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
require('sinon-as-promised')

const Monitor = require('../lib/monitor.js')

const MONITORING_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/monitoring',
  'https://www.googleapis.com/auth/monitoring.read',
  'https://www.googleapis.com/auth/monitoring.write'
]

describe('monitor', function () {
  beforeEach(function () {
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
    sinon.stub(google, 'monitoring').returns(this.client)
    sinon.stub(google.auth, 'fromJSON')
    sinon.stub(google.auth, 'getApplicationDefault')
  })
  afterEach(function () {
    google.monitoring.restore()
    google.auth.fromJSON.restore()
    google.auth.getApplicationDefault.restore()
  })

  describe('constructor', function () {
    describe('errors', function () {
      it('should throw if opts is undefined', function () {
        expect(function () {
          return new Monitor()
        }).to.throw(/opts is required/)
      })

      it('should throw if opts.project is undefined', function () {
        expect(function () {
          return new Monitor({})
        }).to.throw(/project is required/)
      })
    })

    describe('success', function () {
      it('should return an instance of Monitor', function () {
        const monitor = new Monitor({ project: 'project' })
        expect(monitor).to.be.an.instanceOf(Monitor)
      })
    })
  })

  describe('getAuthClient', function () {
    describe('Monitor w/ auth json', function () {
      beforeEach(function () {
        this.authJSON = {}
        this.monitor = new Monitor({ project: 'project', auth: this.authJSON })
        this.authClient = {}
      })

      describe('errors', function () {
        it('should yield error if google.auth.fromJSON errors', function () {
          const err = new Error('boom')
          google.auth.fromJSON.yieldsAsync(err)
          return this.monitor.getAuthClient().catch(function (authErr) {
            expect(authErr).to.equal(err)
          })
        })
      })

      describe('success', function () {
        it('should yield client from google.auth.fromJSON', function () {
          const self = this
          google.auth.fromJSON.yieldsAsync(null, this.authClient)
          return this.monitor.getAuthClient().then(function (authClient) {
            expect(self.authClient).to.equal(authClient)
          })
        })
      })
    })

    describe('Monitor w/ default auth', function () {
      beforeEach(function () {
        const self = this
        this.monitor = new Monitor({ project: 'project' })
        this.authClient = {
          createScopedRequired: sinon.stub().returns(true),
          createScoped: sinon.spy(function () {
            return self.authClient
          })
        }
      })

      describe('errors', function () {
        it('should yield error if google.auth.getApplicationDefault errors', function () {
          const err = new Error('boom')
          google.auth.getApplicationDefault.yieldsAsync(err)
          return this.monitor.getAuthClient().catch(function (authErr) {
            expect(authErr).to.equal(err)
          })
        })
      })

      describe('success', function () {
        it('should yield client from google.auth.getApplicationDefault', function () {
          const self = this
          google.auth.getApplicationDefault.yieldsAsync(null, this.authClient)
          return this.monitor.getAuthClient().then(function (authClient) {
            sinon.assert.calledOnce(self.authClient.createScopedRequired)
            sinon.assert.calledOnce(self.authClient.createScoped)
            sinon.assert.calledWith(self.authClient.createScoped, MONITORING_SCOPES)
            expect(self.authClient).to.equal(authClient)
          })
        })

        describe('twice', function () {
          beforeEach(function () {
            const self = this
            google.auth.getApplicationDefault.yieldsAsync(null, this.authClient)
            return this.monitor.getAuthClient().then(function (authClient) {
              sinon.assert.calledOnce(self.authClient.createScopedRequired)
              sinon.assert.calledOnce(self.authClient.createScoped)
              sinon.assert.calledWith(self.authClient.createScoped, MONITORING_SCOPES)
              expect(self.authClient).to.equal(authClient)
            })
          })

          it('should yield client from google.auth.getApplicationDefault', function () {
            const self = this
            google.auth.getApplicationDefault.yieldsAsync(null, this.authClient)
            return this.monitor.getAuthClient().then(function (authClient) {
              // still called once..
              sinon.assert.calledOnce(self.authClient.createScopedRequired)
              sinon.assert.calledOnce(self.authClient.createScoped)
              sinon.assert.calledWith(self.authClient.createScoped, MONITORING_SCOPES)
              expect(self.authClient).to.equal(authClient)
            })
          })
        })

        describe('pending', function () {
          beforeEach(function () {
            this.promise = this.monitor.getAuthClient()
          })

          it('should yield client from google.auth.getApplicationDefault', function () {
            const promise = this.monitor.getAuthClient()
            expect(promise).to.equal(this.promise)
          })
        })

        describe('no createScopedRequired', function () {
          beforeEach(function () {
            delete this.authClient.createScopedRequired
          })

          it('should yield client from google.auth.getApplicationDefault', function () {
            const self = this
            google.auth.getApplicationDefault.yieldsAsync(null, this.authClient)
            return this.monitor.getAuthClient().catch(function (authErr, authClient) {
              expect(authErr).to.not.exist()
              sinon.assert.calledOnce(self.authClient.createScopedRequired)
              sinon.assert.calledOnce(self.authClient.createScoped)
              sinon.assert.calledWith(self.authClient.createScoped, MONITORING_SCOPES)
              expect(self.authClient).to.equal(authClient)
            })
          })
        })
      })
    })
  })

  describe('monitor instance w/ client', function () {
    beforeEach(function () {
      this.opts = {
        project: 'project',
        resource: {
          type: 'container'
        },
        throttle: 1000
      }
      this.monitor = new Monitor(this.opts)
      sinon.stub(this.monitor, 'getAuthClient').resolves(this.client)
    })

    describe('clearTimers', function () {
      beforeEach(function () {
        sinon.stub(this.monitor, 'emit')
      })
      afterEach(function () {
        this.monitor.emit.restore()
      })

      it('should emit event', function () {
        sinon.assert.notCalled(this.monitor.emit)
        this.monitor.clearTimers()
        sinon.assert.calledOnce(this.monitor.emit)
        sinon.assert.calledWith(this.monitor.emit, 'clearTimers')
      })
    })

    describe('getClient', function () {
      it('should get opts.client', function () {
        const client = this.monitor.getClient()
        expect(client).to.equal(this.client)
      })
    })

    describe('getDefaultThrottle', function () {
      it('should get opts.throttle', function () {
        const throttle = this.monitor.getDefaultThrottle()
        expect(throttle).to.equal(this.opts.throttle)
      })
    })

    describe('getProject', function () {
      it('should get opts.project', function () {
        const project = this.monitor.getProject()
        expect(project).to.equal(this.opts.project)
      })
    })

    describe('getResource', function () {
      it('should get opts.resource', function () {
        const resource = this.monitor.getResource()
        expect(resource).to.equal(this.opts.resource)
      })
    })

    describe('metric factories', function () {
      beforeEach(function () {
        const self = this
        this.mocks = {
          Cumulative: sinon.spy(function () { return self.mocks.cumulative }),
          Gauge: sinon.spy(function () { return self.mocks.gauge }),
          cumulative: {
            create: sinon.stub().resolves()
          },
          gauge: {
            create: sinon.stub().resolves()
          }
        }
        const Monitor = proxyquire('../lib/monitor.js', {
          './gauge.js': this.mocks.Gauge,
          './cumulative.js': this.mocks.Cumulative
        })
        this.monitor = new Monitor({
          project: 'project',
          resource: {
            type: 'container'
          }
        })
        sinon.stub(this.monitor, 'getAuthClient').resolves(this.client)
      })

      describe('createGauge', function () {
        it('should create and resolve a gauge', function () {
          const self = this
          const metricType = 'metricType'
          const opts = {}
          return this.monitor.createGauge(metricType, opts).then(function (gauge) {
            expect(gauge).to.equal(self.mocks.gauge)
            sinon.assert.calledOnce(self.mocks.Gauge)
            sinon.assert.calledWith(self.mocks.Gauge, self.monitor, metricType, opts)
            sinon.assert.calledOnce(self.mocks.gauge.create)
          })
        })
      })

      describe('createCumulative', function () {
        it('should create and resolve a cumulative', function () {
          const self = this
          const metricType = 'metricType'
          const opts = {}
          return this.monitor.createCumulative(metricType, opts).then(function (cumulative) {
            expect(cumulative).to.equal(self.mocks.cumulative)
            sinon.assert.calledOnce(self.mocks.Cumulative)
            sinon.assert.calledWith(self.mocks.Cumulative, self.monitor, metricType, opts)
            sinon.assert.calledOnce(self.mocks.cumulative.create)
          })
        })
      })
    })
  })
})
