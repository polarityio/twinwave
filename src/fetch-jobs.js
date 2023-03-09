const { authenticatedPolarityRequest } = require('./polarity-request');
const { getLogger } = require('./logger');
const { ApiRequestError } = require('./errors');

const { SUCCESS_CODES } = require('./constants');

const getTwinWaveType = (entity) => {
  if (entity.isMD5) {
    return 'md5';
  }
  if (entity.isSHA256) {
    return 'sha256';
  }
  if (entity.isDomain) {
    return 'domain';
  }
  if (entity.isURL) {
    return 'url';
  }
  if (entity.isIP) {
    return 'ip';
  }
};

const fetchJobs = async (entity) => {
  const Logger = getLogger();

  const response = await authenticatedPolarityRequest.authenticateRequest({
    method: 'GET',
    path: '/v1/jobs/searchv2',
    qs: {
      field: getTwinWaveType(entity),
      type: 'substring',
      term: `${entity.value}`,
      mode: 'forensics'
    }
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
