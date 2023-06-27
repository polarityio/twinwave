const _ = require('lodash');
const { getLogger } = require('./logger');

/**
 * Return a Result Object or a Result Miss Object based on the REST API response.
 *
 * @param entity - entity object
 * @param apiResponse - response object from API Rest request
 * @returns {{data: null, entity}|{data: {summary: [string], details}, entity}}
 */
const createResultObject = (entity, apiResponse, options) => {
  if (isMiss(apiResponse)) {
    if (options.enableUrlSubmission && entity.isURL) {
      return {
        entity,
        data: {
          summary: ['Submit URL'],
          details: {
            submitOnly: true
          }
        }
      };
    } else {
      return {
        entity,
        data: null
      };
    }
  }

  return {
    entity,
    data: {
      summary: createSummary(apiResponse.body),
      details: decorateResponseBody(apiResponse.body)
    }
  };
};

const decorateResponseBody = (responseBody) => {
  const Logger = getLogger();
  Logger.trace({ responseBody }, 'Response Body');

  if (Array.isArray(responseBody.Jobs)) {
    responseBody.Jobs = responseBody.Jobs.map((job) => {
      job.Job._displayScore = Math.round(job.Job.Score * 100);
      return job;
    });
  }

  return responseBody;
};

/**
 * Create the Summary Tags
 *
 * @param apiResponse
 * @returns {[string]}
 */
const createSummary = (responseBody) => {
  const Logger = getLogger();
  Logger.trace({ responseBody }, 'API Response');
  const tags = [];

  let jobs = responseBody.Jobs.length;
  tags.push(`Total Jobs: ${jobs}`);

  let highScore = 0;

  for (const job of responseBody.Jobs) {
    let score = Math.round(job.Job.Score * 100);
    if (highScore < score) {
      highScore = score;
    }

    if (job.Job.Verdict.length) {
      tags.push(`Verdict: ${job.Job.Verdict}`);
    }
  }

  tags.push(`High Score: ${highScore}`);

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
