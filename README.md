# Polarity Splunk Attack Analyzer Integration

Splunk Attack Analyzer (SAA) is a threat analysis platform that seamlessly integrates best of breed open source projects, third party commercial solutions and their own technology in a purpose built application that fully automates the steps an experienced security analyst or researcher would follow to analyze a suspected threat.

The Polarity Integration searches the Splunk Attack Analyzer API for Attack Chain data for Domains, URLs, IPs, SHA256 Hashes and MD5 Hashes for phishing related activity and a Score Assessment.

To learn more about SAA, please visit https://www.splunk.com/en_us/products/attack-analyzer.html

| ![lookup example](assets/overlay.png) | ![submit url example](assets/submit-url.png) |
|---------------------------------------|----------------------------------------------|
| *Lookup by Hash or Domain*            | *Submit URL*                                 |

## Splunk Attack Analyzer Integration Options

### API Url

API Url for Splunk Attack Analyzer (SAA) allows searching indicators via the SAA API

### API Key

Splunk Attack Analyzer API Key that supports searching via the SAA API.

### Enable URL Submission

If checked, the integration will support submitting URLs to Splunk Attack Analyzer for any searched URLs.

### Max Concurrent Search Requests

Maximum number of concurrent search requests (defaults to 20). Integration must be restarted after changing this option.

### Minimum Time Between Searches

Minimum amount of time in milliseconds between each entity search (defaults to 100). Integration must be restarted after changing this option.

## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making. For more information about the Polarity platform please see:

https://polarity.io/
