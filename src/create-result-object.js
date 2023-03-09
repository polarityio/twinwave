const _ = require('lodash');
const { getLogger } = require('./logger');

/**
 * Return a Result Object or a Result Miss Object based on the REST API response.
 *
 * @param entity - entity object
 * @param apiResponse - response object from API Rest request
 * @returns {{data: null, entity}|{data: {summary: [string], details}, entity}}
 */
const createResultObject = (entity, apiResponse) => {
  if (isMiss(apiResponse)) {
    return {
      entity,
      data: null
    };
  }

  return {
    entity,
    data: {
      summary: createSummary(apiResponse),
      details: apiResponse.body
    }
  };
};

/**
 * Create the Summary Tags
 *
 * @param apiResponse
 * @returns {[string]}
 */
const createSummary = (apiResponse) => {
  const Logger = getLogger();
  Logger.trace({ apiResponse }, 'API Response');
  const tags = [];

  if (Object.keys(apiResponse.body.Jobs).length > 0) {
    let jobs = apiResponse.body.Jobs.length;
    tags.push(`Total Jobs: ${jobs}`);

    for (const job of apiResponse.body.Jobs) {
      tags.push(`Score: ${parseInt(job.Job.Score)}`);
      if (job.Job.Verdict.length) {
        tags.push(`Verdict: ${job.Job.Verdict}`);
      }
    }
  }

  return _.uniq(tags);
};

/**
 * Shodan Context API returns a 404 status code if a particular IP has no data on it.
 * Note that this statusCode does not appear to be documented.
 *
 * @param apiResponse
 * @returns {boolean}
 */
const isMiss = (apiResponse) => {
  const body = apiResponse.body;
  return (
    Array.isArray(body.Jobs) &&
    body.Jobs.length === 0 &&
    Array.isArray(body.Forensics) &&
    body.Forensics.length === 0
  );
};

module.exports = { createResultObject, isMiss, createSummary };
