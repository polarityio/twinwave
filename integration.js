'use strict';

const { setLogger, getLogger } = require('./src/logger');
const { parseErrorToReadableJSON, ApiRequestError } = require('./src/errors');
const { authenticatedPolarityRequest } = require('./src/polarity-request');
const searchJobs = require('./src/search-jobs');
const { createResultObject } = require('./src/create-result-object');
const submitUrlForScanning = require('./src/submit-url-for-scanning');

let Logger = null;

const startup = (logger) => {
  Logger = logger;
  setLogger(Logger);
};

/**
 * @param entities
 * @param options
 * @param cb
 * @returns {Promise<void>}
 */
const doLookup = async (entities, options, cb) => {
  try {
    authenticatedPolarityRequest.initiateLimiter(options);

    // set authentication headers and options
    authenticatedPolarityRequest.setAuthHeaders({
      url: options.url,
      'X-Api-key': options.apiKey
    });

    const lookupResults = await Promise.all(
      entities.map(async (entity) => {
        const jobs = await searchJobs(entity);

        return createResultObject(entity, jobs, options);
      })
    );

    //Logger.trace({ lookupResults }, 'Lookup Results');
    cb(null, lookupResults);
  } catch (error) {
    const errorAsPojo = parseErrorToReadableJSON(error);
    Logger.error({ error: errorAsPojo }, 'Error in doLookup');
    cb(errorAsPojo);
  }
};

const onMessage = async (payload, options, cb) => {
  const Logger = getLogger();

  try {
    switch (payload.action) {
      case 'SUBMIT_URL_FOR_SCANNING':
        const response = await submitUrlForScanning(payload, options);
        Logger.trace({ response }, 'SUBMIT_URL_FOR_SCANNING Response');
        cb(null, response);
        break;
      case 'RETRY_LOOKUP':
        await doLookup([payload.entity], options, (err, lookupResults) => {
          if (err) {
            return cb(err);
          }

          if (lookupResults.length > 0) {
            cb(null, lookupResults[0]);
          } else {
            Logger.error(
              { lookupResults },
              'Unexpected lookup results from search retry'
            );
            cb({
              detail: 'Unexpected error occurred.'
            });
          }
        });
        break;
      default:
        return;
    }
  } catch (error) {
    Logger.error({ error }, 'Error in SUBMIT_URL_FOR_SCANNING');
    cb(error, {});
  }
};

module.exports = {
  startup,
  doLookup,
  onMessage
};
