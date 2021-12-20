const _ = require('lodash');
const Bottleneck = require('bottleneck/es5');
const config = require('./config/config');
const fs = require('fs');
const { map } = require('lodash/fp');
const request = require('request');

let limiter = null;
let requestWithDefaults;

let Logger;

const _setupLimiter = (options) => {
  limiter = new Bottleneck({
    maxConcurrent: Number.parseInt(options.maxConcurrent, 10), // no more than 5 lookups can be running at single time
    highWater: 100, // no more than 100 lookups can be queued up
    strategy: Bottleneck.strategy.OVERFLOW,
    minTime: Number.parseInt(options.minTime, 10) // don't run lookups faster than 1 every 200 ms
  });
};

function startup(logger) {
  let defaults = {};
  Logger = logger;
  const { cert, key, passphrase, ca, proxy, rejectUnauthorized } = config.request;
  if (typeof cert === 'string' && cert.length > 0) {
    defaults.cert = fs.readFileSync(cert);
  }
  if (typeof key === 'string' && key.length > 0) {
    defaults.key = fs.readFileSync(key);
  }
  if (typeof passphrase === 'string' && passphrase.length > 0) {
    defaults.passphrase = passphrase;
  }
  if (typeof ca === 'string' && ca.length > 0) {
    defaults.ca = fs.readFileSync(ca);
  }
  if (typeof proxy === 'string' && proxy.length > 0) {
    defaults.proxy = proxy;
  }
  if (typeof rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = rejectUnauthorized;
  }

  let _requestWithDefaults = request.defaults(defaults);

  requestWithDefaults = (requestOptions) =>
    new Promise((resolve, reject) => {
      _requestWithDefaults(requestOptions, (err, res, body) => {
        if (err) return reject(err);
        const response = { ...res, body };

        try {
          checkForStatusError(response);
        } catch (err) {
          reject(err);
        }

        resolve(response);
      });
    });
}

const buildRequestOptions = (entity, options, callback) => {
  let fieldType;
  let API_URL = options.url + '/v1/jobs/search';

  switch (true) {
    case entity.isURL:
    case entity.isDomain:
      fieldType = 'url';
      break;
    case entity.isSHA256:
      fieldType = 'sha256';
      break;
    case entity.isMD5:
      fieldType = 'md5';
    default:
      undefined;
  }

  if (fieldType) {
    return (requestOptions = {
      method: 'GET',
      url: API_URL + `?field=${fieldType}&type=substring&term=${entity.value}`,
      headers: {
        'X-Api-Key': options.apiKey
      },
      json: true
    });
  }
};

const doLookup = async (entities, options, callback) => {
  if (!limiter) _setupLimiter(options);

  const fetchApiData = limiter.wrap(_fetchApiData);

  try {
    const lookupResults = await Promise.all(
      map(async (entity) => await fetchApiData(entity, options), entities)
    );

    return callback(null, lookupResults);
  } catch (err) {
    return callback(err);
  }
};

const _fetchApiData = async (entity, options) => {
  try {
    const requestOptions = buildRequestOptions(entity, options);

    Logger.trace({ requestOptions }, 'REQUEST_OPTIONS');

    response = await requestWithDefaults(requestOptions);

    Logger.trace({ response }, 'REQUEST_RESPONSE');

    const apiData = (fetchResponses[response.statusCode] || retryablePolarityResponse)(
      entity,
      response
    );

    Logger.trace({ apiData }, 'LOOKUP_RESULT');
    return apiData;
  } catch (err) {
    const isConnectionReset = _.get(err, 'code', '') === 'ECONNRESET';
    if (isConnectionReset) return retryablePolarityResponse(entity);
    else throw polarityError(err);
  }
};

const checkForStatusError = (response) => {
  const statusCode = response.statusCode;

  Logger.trace({ STATUS_CODE: statusCode });

  if (![200, 429, 500, 502, 504].includes(statusCode)) {
    const requestError = Error('Request Error');
    requestError.status = statusCode;
    requestError.description = JSON.stringify(response.body);
    requestError.requestOptions = requestOptions;
    throw requestError;
  }
};

/**
 * These functions return potential response objects the integration can return to the client
 */
const polarityError = (err) => ({
  detail: err.message || 'Unknown Error',
  error: err
});

const emptyResponse = (entity) => ({
  entity,
  data: null
});

const polarityResponse = (entity, { body }) => ({
  entity,
  data: body.Jobs.length
    ? {
        summary: getSummary(body),
        details: body.Jobs
      }
    : null
});

const retryablePolarityResponse = (entity) => [
  {
    entity,
    isVolatile: true,
    data: {
      summary: ['Lookup limit reached'],
      details: {
        summaryTag: 'Lookup limit reached',
        errorMessage:
          'A temporary TwinWave API search limit was reached. You can retry your search by pressing the "Retry Search" button.'
      }
    }
  }
];

const fetchResponses = {
  200: polarityResponse,
  400: emptyResponse,
  403: emptyResponse
};

const onMessage = (payload, options, callback) => {
  switch (payload.action) {
    case 'RETRY_LOOKUP':
      doLookup([payload.entity], options, (err, lookupResults) => {
        if (err) {
          Logger.error({ err }, 'Error retrying lookup');
          callback(err);
        } else {
          callback(
            null,
            lookupResults && lookupResults[0] && lookupResults[0].data === null
              ? { data: { summary: ['No Results Found on Retry'] } }
              : lookupResults[0]
          );
        }
      });
      break;
  }
};

const getSummary = (data) => {
  let tags = [];

  if (Object.keys(data.Jobs).length > 0) {
    const jobs = data.Jobs.length;
    tags.push(`Total Jobs: ${jobs}`);

    for (const job of data.Jobs) {
      tags.push(`Score: ${job.Job.Score}`);
      if (job.Job.Verdict.length) {
        tags.push(`Verdict: ${job.Job.Verdict}`);
      }
    }
  }

  return _.uniq(tags);
};

function validateOption(errors, options, optionName, errMessage) {
  if (!(typeof options[optionName].value === 'string' && options[optionName].value)) {
    errors.push({
      key: optionName,
      message: errMessage
    });
  }
}

function validateOptions(options, callback) {
  let errors = [];

  validateOption(errors, options, 'url', 'You must provide an api url.');
  validateOption(errors, options, 'apiKey', 'You must provide a valid access key.');

  if (options.maxConcurrent.value < 1) {
    errors = errors.concat({
      key: 'maxConcurrent',
      message: 'Max Concurrent Requests must be 1 or higher'
    });
  }

  if (options.minTime.value < 1) {
    errors = errors.concat({
      key: 'minTime',
      message: 'Minimum Time Between Lookups must be 1 or higher'
    });
  }

  callback(null, errors);
}

module.exports = {
  doLookup,
  startup,
  onMessage,
  validateOptions
};
