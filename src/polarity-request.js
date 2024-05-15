const fs = require('fs');
const Bottleneck = require('bottleneck/es5');
const request = require('postman-request');
const { getLogger } = require('./logger');
const { NetworkError, RetryRequestError } = require('./errors');
const {
  request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
} = require('../config/config.js');
const { get } = require('lodash/fp');
const _ = require('lodash');
const fp = require('lodash/fp');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

let limiter = null;

const _setupLimiter = (options) => {
  getLogger().trace({ options }, 'Setting up Limiter');
  limiter = new Bottleneck({
    maxConcurrent: fp.parseInt(10, options.maxConcurrent), // no more than options.maxConcurrent lookups can be running at single time
    highWater: 2, // no more than 100 lookups can be queued up
    strategy: Bottleneck.strategy.OVERFLOW,
    minTime: fp.parseInt(10, options.minTime) // don't run lookups faster than 1 every options.minTime ms
  });
};

const defaults = {
  ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
  ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
  ...(_configFieldIsValid(key) && { key: fs.readFileSync }),
  ...(_configFieldIsValid(passphrase) && { passphrase }),
  ...(_configFieldIsValid(proxy) && { proxy }),
  ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
  json: true
};

class PolarityRequest {
  constructor() {
    this.requestWithDefaults = request.defaults(defaults);
  }

  async request(requestOptions) {
    return new Promise(async (resolve, reject) => {
      this.requestWithDefaults(requestOptions, (err, response) => {
        if (err) {
          return reject(
            new NetworkError('Unable to complete network request', {
              cause: err,
              requestOptions
            })
          );
        }

        // The SAA API will return a 429 if we have exceeded the request rate limit
        // We catch these and throw an error so it can be handled by the retry logic
        if (response.statusCode === 429) {
          return reject(
            new RetryRequestError('Too many requests', {
              requestOptions,
              response
            })
          );
        }

        resolve({
          ...response,
          requestOptions
        });
      });
    });
  }
}

class AuthenticatedPolarityRequest extends PolarityRequest {
  constructor() {
    super();
  }

  setAuthHeaders(options) {
    this.url = options.url;
    this.headers = {
      ...options
    };
  }

  initiateLimiter(options) {
    if (limiter === null) {
      _setupLimiter(options);
    }
  }

  async authenticateRequest(requestOptions) {
    const Logger = getLogger();
    const authenticatedRequestOptions = {
      method: requestOptions.method,
      url: this.url + requestOptions.path,
      headers: this.headers,
      ...(get('body', requestOptions) && { body: requestOptions.body }),
      ...(get('qs', requestOptions) && { qs: requestOptions.qs })
    };

    try {
      return await limiter.schedule(
        super.request.bind(this),
        authenticatedRequestOptions
      );
    } catch (err) {
      if (err instanceof Bottleneck.BottleneckError) {
        Logger.warn('Request queue limit reached');
        return {
          errorMessage: `The request queue limit has been reached.`,
          allowRetry: true,
          maxRequestQueueLimitHit: true,
          isConnectionReset: false,
          apiLimitExceeded: false
        };
      }

      Logger.error(err, 'Error in authenticateRequest');
      const apiLimitExceeded = err instanceof RetryRequestError;
      const isConnectionReset = _.get(err, 'error.code', '') === 'ECONNRESET';

      if (isConnectionReset || apiLimitExceeded) {
        Logger.trace(
          {
            maxRequestQueueLimitHit: false,
            isConnectionReset,
            apiLimitExceeded
          },
          'Retry Required'
        );
        return {
          errorMessage: `A temporary API limit was reached.`,
          allowRetry: true,
          maxRequestQueueLimitHit: false,
          isConnectionReset,
          apiLimitExceeded
        };
      }

      throw err;
    }
  }
}

module.exports = {
  polarityRequest: new PolarityRequest(),
  authenticatedPolarityRequest: new AuthenticatedPolarityRequest()
};
