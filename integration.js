'use strict';

const { setLogger } = require('./src/logger');
const { parseErrorToReadableJSON, ApiRequestError } = require('./src/errors');
const { authenticatedPolarityRequest } = require('./src/polarity-request');
const fetchJobs = require('./src/fetch-jobs');
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
    // set authentication headers and options
    authenticatedPolarityRequest.setAuthHeaders({
      url: options.url,
      'X-Api-key': options.apiKey
    });

    const lookupResults = await Promise.all(
      entities.map(async (entity) => {
        const jobs = await fetchJobs(entity);

        return createResultObject(entity, jobs);
      })
    );

    Logger.trace({ lookupResults }, 'Lookup Results');
    cb(null, lookupResults);
  } catch (error) {
    const errorAsPojo = parseErrorToReadableJSON(error);
    Logger.error({ error: errorAsPojo }, 'Error in doLookup');
    cb(error);
  }
};

const onMessage = async (payload, options, cb) => {
  const Logger = Logger.getLogger();

  try {
    switch (payload.action) {
      case 'SUBMIT_URL_FOR_SCANNING':
        const response = await submitUrlForScanning(payload);
        cb(null, response);
        break;
      default:
        return 
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
