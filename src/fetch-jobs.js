const { authenticatedPolarityRequest } = require('./polarity-request');
const { getLogger } = require('./logger');
const { ApiRequestError } = require('./errors');

const { SUCCESS_CODES } = require('./constants');

const fetchJobs = async (entity) => {
  const Logger = getLogger();

  const response = await authenticatedPolarityRequest.authenticateRequest({
    method: 'GET',
    path: `/v1/jobs/search?field=${entity.type}&type=substring&term=${entity.value}`
  });

  Logger.trace({ response }, 'Fetch Jobs API Response');

  // Handle API errors
  if (!SUCCESS_CODES.includes(response.statusCode)) {
    throw new ApiRequestError(`Unexpected status code ${response.statusCode}`, {
      statusCode: response.statusCode,
      body: response.body,
      requestOptions: response.requestOptions
    });
  }

  //return raw response from query functions
  return response;
};

module.exports = fetchJobs;
