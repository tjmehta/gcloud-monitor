const google = require('googleapis')
const sinon = require('sinon')
require('sinon-as-promised')

const gmonitor = require('../index.js')

describe('functional tests', function () {
  beforeEach(function () {
    const self = this
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
    this.authClient = {
      createScopedRequired: sinon.stub().returns(true),
      createScoped: sinon.spy(function () {
        return self.authClient
      })
    }
    sinon.stub(google, 'monitoring').returns(this.client)
    sinon.stub(google.auth, 'getApplicationDefault').yieldsAsync(null, this.authClient)
  })
  afterEach(function () {
    google.monitoring.restore()
    google.auth.getApplicationDefault.restore()
  })

  describe('gauge', function () {
    beforeEach(function () {
      this.opts = {
        project: 'project',
        resource: {
          type: 'gke_container',
          labels: {
            project_id: 'project_id',
            cluster_name: 'cluster_name',
            namespace_id: 'namespace_id',
            instance_id: 'instance_id',
            pod_id: 'pod_id',
            container_name: 'container_name',
            zone: 'zone'
          }
        }
      }
    })

    describe('no throttle', function () {
      beforeEach(function () {
        this.monitor = gmonitor(this.opts)
      })

      it('should create a gauge and report it', function () {
        const self = this
        this.client.projects.metricDescriptors.create.yieldsAsync()
        this.client.projects.timeSeries.create.yieldsAsync()
        return this.monitor.createGauge('fooGauge', {
          displayName: 'Foo',
          unit: 'foos'
        }).then(function (gauge) {
          return gauge.report(1)
        }).then(function () {
          sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
          sinon.assert.calledOnce(self.client.projects.timeSeries.create)
        })
      })
    })

    describe('throttle', function () {
      beforeEach(function () {
        this.clock = sinon.useFakeTimers()
        this.opts.throttle = 1000
        this.monitor = gmonitor(this.opts)
      })
      afterEach(function () {
        this.clock.restore()
      })

      describe('gauge', function () {
        beforeEach(function () {
          this.gaugeOpts = {
            displayName: 'Foo',
            unit: 'foos'
          }
        })

        describe('groupBy', function () {
          beforeEach(function () {
            this.gaugeOpts.groupBy = function (timeSeriesItem) {
              return timeSeriesItem.metric.labels.name
            }
          })

          it('should group gauges by group (name label)', function () {
            const self = this
            const dates = [
              new Date('Mon Dec 1 1969 16:00:00 GMT-0800'),
              new Date('Tue Dec 2 1969 16:00:00 GMT-0800'),
              new Date('Wed Dec 3 1969 16:00:00 GMT-0800'),
              new Date('Thu Dec 4 1969 16:00:00 GMT-0800')
            ]
            const values = [
              100,
              200,
              101,
              201
            ]
            this.client.projects.metricDescriptors.create.yieldsAsync()
            this.client.projects.timeSeries.create.yieldsAsync()
            return this.monitor.createGauge('fooGauge', this.gaugeOpts).then(function (gauge) {
              const p = Promise.all([
                gauge.report(values[0], dates[0], { name: 'foo' }),
                gauge.report(values[1], dates[1], { name: 'foo' }),
                gauge.report(values[2], dates[2], { name: 'bar' }),
                gauge.report(values[3], dates[3], { name: 'bar' })
              ])
              // tick fake clock
              self.clock.tick(self.opts.throttle)
              // return report all promise
              return p
            }).then(function () {
              sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
              sinon.assert.calledOnce(self.client.projects.timeSeries.create)
              sinon.assert.calledWith(self.client.projects.timeSeries.create, {
                auth: self.authClient,
                name: 'projects/project',
                resource: {
                  timeSeries: [{
                    metric: {
                      type: 'custom.googleapis.com/fooGauge',
                      labels: { name: 'foo' }
                    },
                    resource: self.opts.resource,
                    metricKind: 'GAUGE',
                    valueType: 'INT64',
                    points: {
                      interval: {
                        endTime: dates[1]
                      },
                      value: {
                        int64Value: values[1]
                      }
                    }
                  }, {
                    metric: {
                      type: 'custom.googleapis.com/fooGauge',
                      labels: { name: 'bar' }
                    },
                    resource: self.opts.resource,
                    metricKind: 'GAUGE',
                    valueType: 'INT64',
                    points: {
                      interval: {
                        endTime: dates[3]
                      },
                      value: {
                        int64Value: values[3]
                      }
                    }
                  }]
                }
              })
            })
          })
        })

        it('should create a gauge and report it (throttled)', function () {
          const self = this
          this.client.projects.metricDescriptors.create.yieldsAsync()
          this.client.projects.timeSeries.create.yieldsAsync()
          return this.monitor.createGauge('fooGauge', this.gaugeOpts).then(function (gauge) {
            const p = Promise.all([
              gauge.report(1),
              gauge.report(2),
              gauge.report(3),
              gauge.report(4)
            ])
            // tick fake clock
            self.clock.tick(self.opts.throttle)
            // return report all promise
            return p
          }).then(function () {
            sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
            sinon.assert.calledOnce(self.client.projects.timeSeries.create)
          })
        })

        it('should create a gauge and report it (throttled, two intervals)', function () {
          const self = this
          const dates = [
            new Date('Mon Dec 1 1969 16:00:00 GMT-0800'),
            new Date('Tue Dec 2 1969 16:00:00 GMT-0800'),
            new Date('Wed Dec 3 1969 16:00:00 GMT-0800'),
            new Date('Thu Dec 4 1969 16:00:00 GMT-0800'),
            new Date('Fri Dec 5 1969 16:00:00 GMT-0800')
          ]
          this.client.projects.metricDescriptors.create.yieldsAsync()
          this.client.projects.timeSeries.create.yieldsAsync()
          return this.monitor.createGauge('fooGauge', this.gaugeOpts).then(function (gauge) {
            self.gauge = gauge
            const p = Promise.all([
              gauge.report(1, dates[0])
            ])
            // tick fake clock
            self.clock.tick(self.opts.throttle)
            // return report all promise
            return p
          }).then(function () {
            sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
            sinon.assert.calledOnce(self.client.projects.timeSeries.create)
          }).then(function () {
            const p = Promise.all([
              self.gauge.report(5, dates[1]),
              self.gauge.report(6, dates[2]),
              self.gauge.report(7, dates[3]),
              self.gauge.report(8, dates[4])
            ])
            // tick fake clock
            self.clock.tick(self.opts.throttle)
            // return report all promise
            return p
          }).then(function () {
            sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
            sinon.assert.calledTwice(self.client.projects.timeSeries.create)
            sinon.assert.calledWith(self.client.projects.timeSeries.create, {
              auth: self.authClient,
              name: 'projects/project',
              resource: {
                timeSeries: [{
                  metric: {
                    type: 'custom.googleapis.com/fooGauge',
                    labels: {}
                  },
                  resource: self.opts.resource,
                  metricKind: 'GAUGE',
                  valueType: 'INT64',
                  points: {
                    interval: {
                      endTime: dates[4]
                    },
                    value: {
                      int64Value: 8
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

  describe('cumulative', function () {
    describe('groupBy', function () {
      beforeEach(function () {
        this.opts = {
          project: 'project',
          resource: {
            type: 'gke_container',
            labels: {
              project_id: 'project_id',
              cluster_name: 'cluster_name',
              namespace_id: 'namespace_id',
              instance_id: 'instance_id',
              pod_id: 'pod_id',
              container_name: 'container_name',
              zone: 'zone'
            }
          },
          throttle: 1000
        }
        this.clock = sinon.useFakeTimers()
        this.monitor = gmonitor(this.opts)
        this.cumuOpts = {
          groupBy: function (timeSeriesItem) {
            return timeSeriesItem.metric.labels && timeSeriesItem.metric.labels.name
          },
          displayName: 'Foo',
          unit: 'foos'
        }
      })
      afterEach(function () {
        this.clock.restore()
      })

      it('should create a cumulative and report it (throttled, two intervals, two groups)', function () {
        const self = this
        const dates = [
          new Date('Mon Dec 1 1969 16:00:00 GMT-0800'),
          new Date('Tue Dec 2 1969 16:00:00 GMT-0800'),
          new Date('Wed Dec 3 1969 16:00:00 GMT-0800'),
          new Date('Thu Dec 4 1969 16:00:00 GMT-0800'),
          new Date('Fri Dec 5 1969 16:00:00 GMT-0800')
        ]
        this.client.projects.metricDescriptors.create.yieldsAsync()
        this.client.projects.timeSeries.create.yieldsAsync()
        return this.monitor.createCumulative('fooCumu', this.cumuOpts).then(function (cumulative) {
          self.cumulative = cumulative
          const p = Promise.all([
            cumulative.report(1, dates[0], { name: 'one' })
          ])
          // tick fake clock
          self.clock.tick(self.opts.throttle)
          // return report all promise
          return p
        }).then(function () {
          sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
          sinon.assert.calledOnce(self.client.projects.timeSeries.create)
        }).then(function () {
          const p = Promise.all([
            self.cumulative.report(5, dates[1], { name: 'two' }),
            self.cumulative.report(6, dates[2], { name: 'two' }),
            self.cumulative.report(7, dates[3], { name: 'two' }),
            self.cumulative.report(8, dates[4], { name: 'two' })
          ])
          // tick fake clock
          self.clock.tick(self.opts.throttle)
          // return report all promise
          return p
        }).then(function () {
          sinon.assert.calledOnce(self.client.projects.metricDescriptors.create)
          sinon.assert.calledTwice(self.client.projects.timeSeries.create)
          sinon.assert.calledWith(self.client.projects.timeSeries.create, {
            auth: self.authClient,
            name: 'projects/project',
            resource: {
              timeSeries: [{
                metric: {
                  type: 'custom.googleapis.com/fooCumu',
                  labels: {
                    name: 'one'
                  }
                },
                resource: self.opts.resource,
                metricKind: 'CUMULATIVE',
                valueType: 'INT64',
                points: {
                  interval: {
                    startTime: new Date('Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'),
                    endTime: dates[0]
                  },
                  value: {
                    int64Value: 1
                  }
                }
              }]
            }
          })
          sinon.assert.calledWith(self.client.projects.timeSeries.create, {
            auth: self.authClient,
            name: 'projects/project',
            resource: {
              timeSeries: [{
                metric: {
                  type: 'custom.googleapis.com/fooCumu',
                  labels: {
                    name: 'two'
                  }
                },
                resource: self.opts.resource,
                metricKind: 'CUMULATIVE',
                valueType: 'INT64',
                points: {
                  interval: {
                    startTime: new Date('Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'),
                    endTime: dates[4]
                  },
                  value: {
                    int64Value: 5 + 6 + 7 + 8
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
