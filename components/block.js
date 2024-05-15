'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  jobs: Ember.computed.alias('details.Jobs'),
  urlToScan: '',
  priority: 0,
  engines: [],
  parameters: [],
  profile: 'string',
  expandableTitleStates: {},
  activeTab: 'jobs',
  JobID: '',
  init: function () {
    this._super(...arguments);
    if (this.get('details.submitOnly')) {
      this.set('urlToScan', this.get('block.entity.value'));
      this.set('activeTab', 'submissions');
    }
  },
  actions: {
    stopPropagation: function (url) {
      console.info('Stop Propagation of link click');
      window.open(url, '_blank');
    },
    changeTab: function (tabName) {
      this.set('activeTab', tabName);
    },
    toggleJob: function (jobIndex) {
      this.toggleProperty(`jobs.${jobIndex}.__open`);
    },
    retryLookup: function () {
      this.set('running', true);
      this.set('errorMessage', '');
      const payload = {
        action: 'RETRY_LOOKUP',
        entity: this.get('block.entity')
      };
      this.sendIntegrationMessage(payload)
        .then((result) => {
          if (result.data.summary) this.set('summary', result.summary);
          this.set('block.data', result.data);
        })
        .catch((err) => {
          this.set('details.errorMessage', JSON.stringify(err, null, 4));
        })
        .finally(() => {
          this.set('running', false);
        });
    },
    submitUrlForScanning: function () {
      this.set('urlValidationError', '');
      this.set('running', true);
      this.set('errorMessage', '');

      if (this.isValidUrl() === false) {
        this.set(
          'urlValidationError',
          'Invalid URL. URLs must begin with the scheme `http://` or `https://`'
        );
        this.set('running', false);
        return;
      }

      const payload = {
        action: 'SUBMIT_URL_FOR_SCANNING',
        data: {
          url: this.get('urlToScan'),
          priority: this.get('priority')
        },
        entity: this.get('block.entity')
      };

      this.sendIntegrationMessage(payload)
        .then((result) => {
          console.log('result', result);
          this.set('JobID', result.body.JobID);
        })
        .catch((err) => {
          console.log('err', err);
          this.set('details.errorMessage', JSON.stringify(err, null, 4));
        })
        .finally(() => {
          this.set('running', false);
        });
    },
    toggleExpandableTitle: function (index) {
      const modifiedExpandableTitleStates = Object.assign(
        {},
        this.get('expandableTitleStates'),
        {
          [index]: !this.get('expandableTitleStates')[index]
        }
      );
      this.set(`expandableTitleStates`, modifiedExpandableTitleStates);
    }
  },
  isValidUrl: function () {
    let url;
    const string = this.get('urlToScan');

    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
  }
});
