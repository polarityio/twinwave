const fs = require('fs');
const request = require('postman-request');
const { NetworkError } = require('./errors');
const {
  request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
} = require('../config/config.js');
const { get } = require('lodash/fp');
const { options } = require('postman-request');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

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
  constructor () {
    this.requestWithDefaults = request.defaults(defaults);
  }

  async request (requestOptions) {
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

        resolve({
          ...response,
          requestOptions
        });
      });
    });
  }

  async runRequestsInParallel (requestsOptions, responseGetPath = 'body', limit = 10) {
    const unexecutedRequestFunctions = map(
      ({ entity, ...requestOptions }) =>
        async () => {
          const result = get(responseGetPath, await this.request(requestOptions));
          return entity ? { entity, result } : result;
        },
      requestsOptions
    );

    return parallelLimit(unexecutedRequestFunctions, limit);
  }
}

class AuthenticatedPolarityRequest extends PolarityRequest {
  constructor () {
    super();
  }

  setAuthHeaders (options) {
    this.url = options.url;
    this.headers = {
      ...options
    };
  }

  async authenticateRequest (requestOptions) {
    return super.request({
      method: requestOptions.method,
      url: this.url + requestOptions.path,
      headers: this.headers,
      ...(get('body', requestOptions) && { body: requestOptions.body })
    });
  }
}



// class RunRequestsInParallel extends PolarityRequest {
//   constructor () {
//     super();
//   }

// }

// const { parallelLimit } = require('async');
// const { map, get } = require('lodash/fp');
// const createRequestWithDefaults = require('./createRequestWithDefaults');

// const requestWithDefaults = createRequestWithDefaults();

// const requestsInParallel = async (
//   requestsOptions,
//   responseGetPath = 'body',
//   limit = 10
// ) => {
//   const { Logger } = require('../../integration');

//   const unexecutedRequestFunctions = map(
//     ({ entity, ...requestOptions }) =>
//       async () => {
//         const result = get(responseGetPath, await requestWithDefaults(requestOptions));
//         return entity ? { entity, result } : result;
//       },
//     requestsOptions
//   );

//   return await parallelLimit(unexecutedRequestFunctions, limit);
// };

// module.exports = { createRequestWithDefaults, requestWithDefaults, requestsInParallel };

module.exports = {
  polarityRequest: new PolarityRequest(),
  authenticatedPolarityRequest: new AuthenticatedPolarityRequest()
};
