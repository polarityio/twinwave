const { authenticatedPolarityRequest } = require('./polarity-request');
const { getLogger } = require('./logger');
const { ApiRequestError } = require('./errors');

const { SUCCESS_CODES } = require('./constants');

const submitUrlForScanning = async (payload) => {
  const Logger = getLogger();

  Logger.trace({ payload }, 'Payload for Submit URL for Scanning API Request');

  const response = await authenticatedPolarityRequest.authenticateRequest({
    method: 'POST',
    path: `/v1/jobs/urls`,
    body: {
      url: payload.data.url,
      priority: Number(payload.data.priority)
    }
  });

  Logger.trace({ response }, 'Fetch Jobs API Response');

  // Handle API errors
  if (!SUCCESS_CODES.includes(response.statusCode)) {
    throw new ApiRequestError(`Unexpected status code ${response.statusCode}`, {
      statusCode: response.statusCode,
      requestOptions: response.requestOptions
    });
  }

  //return raw response from query functions
  return response;
};

module.exports = submitUrlForScanning;
