'use strict';

const { setLogger } = require('./src/logger');
const { parseErrorToReadableJSON } = require('./src/errors');
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
 * forEach entity
 *   MakeNetworkRequest1 -- Makes the network request, handles network errors only, returns raw network response
 *   HandleAPIErrors -- handles error handling of the API response
 *   CreateResultObject -- Handles any processing of the raw network response, creates a resultObject or resultMissObject
 *
 * @param entities
 * @param options
 * @param cb
 * @returns {Promise<void>}
 */
const doLookup = async (entities, options, cb) => {
  try {
    // set authentication headers and options
    authenticatedPolarityRequest.setAuthHeaders({
      ...options,
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
  try {
    const response = await submitUrlForScanning(payload);
    Logger.trace({ response }, 'RESPONSE');
    cb(null, response);
  } catch (error) {
    cb(error, {});
  }
};

module.exports = {
  startup,
  doLookup,
  onMessage
  // onDetails
};

// Twinwave: Ability to submit URLs and hashes for Twinwave to process
// We have gotten the request from a few customers now to make this a bidirectional integration and allow for users to submit a file and url for processing by Twinwave.

// From what I can tell the File and URL endpoints should work. Its unclear based on the docs if the file endpoint needs to actual file or not if it does then we will just implement URLs.

// Endpoints to utilize for the integration:

// https://api.twinwave.io/v1/jobs/urls

// https://api.twinwave.io/v1/jobs/files

// User Experience:

// There is a Submit button that will take the entity (url or file) and submit it to the appropriate job endpoint. The return for the user should be a link back to twinwave for them to follow the job and a success the submission went through or not
