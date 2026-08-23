# Winston Logging Monitoring Guide

> **Historical logging examples may mention SBERT fallback.** The current
> production semantic path uses Voyage and fails closed when unavailable; use
> the [monitoring runbook](../deployment/monitoring-and-logging.md) and
> [direct-similarity contract](../api/direct-similarity-security-contract.md)
> for current operational behavior.

## Overview

This guide provides comprehensive information on monitoring and analyzing Winston logs in the Topic Similarity API.

## Log Configuration

### Log Levels

Winston uses the following log levels (in order of priority):

| Level   | Priority | Usage                                    | Color  |
|---------|----------|------------------------------------------|--------|
| error   | 0        | Error events that need immediate attention | Red    |
| warn    | 1        | Warning events that should be reviewed   | Yellow |
| info    | 2        | Informational messages about normal operations | Green |
| http    | 3        | HTTP request/response logs               | Magenta|
| verbose | 4        | Detailed operational information         | Cyan   |
| debug   | 5        | Debug information for development        | Blue   |
| silly   | 6        | Very detailed debug information          | Gray   |

### Current Configuration

**Development Mode:**
- Console output: Colorized, human-readable format
- File output: JSON format in `logs/` directory
- Log level: `info` (shows info, warn, error)

**Production Mode:**
- Console output: JSON format for log aggregation
- File output: JSON format in `logs/` directory
- Log level: `warn` (shows warn, error only)

### Log Files

```
logs/
├── error.log       # Error-level logs only
├── combined.log    # All logs
└── exceptions.log  # Uncaught exceptions
```

## Log Format

### Error Logs

```json
{
  "level": "error",
  "message": "Error occurred: Database connection failed",
  "timestamp": "2026-02-09T01:58:52.123Z",
  "statusCode": 500,
  "method": "POST",
  "path": "/api/similarity/check",
  "body": {
    "topic": "Machine Learning in Healthcare"
  },
  "stack": "Error: Database connection failed\n    at ..."
}
```

### Warning Logs

```json
{
  "level": "warn",
  "message": "SBERT service unavailable, using fallback algorithms",
  "timestamp": "2026-02-09T01:58:52.123Z",
  "method": "POST",
  "path": "/api/similarity/check"
}
```

### Info Logs

```json
{
  "level": "info",
  "message": "Similarity check completed successfully",
  "timestamp": "2026-02-09T01:58:52.123Z",
  "method": "POST",
  "path": "/api/similarity/check",
  "processingTime": 1234
}
```

## Monitoring Strategies

### 1. Real-Time Monitoring

**Development:**
```bash
# Watch all logs in real-time
tail -f logs/combined.log

# Watch only errors
tail -f logs/error.log

# Watch with color highlighting
tail -f logs/combined.log | grep --color=always "error\|warn"
```

**Production:**
```bash
# Monitor errors in real-time
tail -f logs/error.log | jq '.'

# Monitor with filtering
tail -f logs/combined.log | jq 'select(.level == "error")'
```

### 2. Log Analysis

**Count errors by type:**
```bash
cat logs/error.log | jq -r '.message' | sort | uniq -c | sort -rn
```

**Find errors in last hour:**
```bash
cat logs/error.log | jq -r 'select(.timestamp > "'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)'")'
```

**Group errors by endpoint:**
```bash
cat logs/error.log | jq -r '.path' | sort | uniq -c | sort -rn
```

**Find slow requests (>2 seconds):**
```bash
cat logs/combined.log | jq 'select(.processingTime > 2000)'
```

### 3. Error Rate Monitoring

**Calculate error rate:**
```bash
# Total requests
TOTAL=$(cat logs/combined.log | jq -s 'length')

# Error requests
ERRORS=$(cat logs/error.log | jq -s 'length')

# Calculate percentage
echo "scale=2; ($ERRORS / $TOTAL) * 100" | bc
```

**Errors per hour:**
```bash
cat logs/error.log | jq -r '.timestamp' | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c
```

## Alert Thresholds

### Critical Alerts (Immediate Action Required)

1. **Error Rate > 5%**
   - Action: Investigate immediately
   - Check: Database connectivity, service dependencies

2. **Database Connection Errors**
   - Action: Check database status
   - Verify: Connection string, credentials, network

3. **Repeated 500 Errors (>10 in 5 minutes)**
   - Action: Check application logs
   - Consider: Rolling back recent deployments

### Warning Alerts (Review Within 1 Hour)

1. **Error Rate > 1%**
   - Action: Monitor trend
   - Review: Recent changes

2. **SBERT Service Down**
   - Action: Check SBERT service status
   - Note: System continues with fallback algorithms

3. **Slow Requests (>3 seconds)**
   - Action: Review performance
   - Check: Database queries, SBERT service

### Info Alerts (Review Daily)

1. **Rate Limit Hits**
   - Action: Review rate limit settings
   - Consider: Adjusting limits for legitimate users

2. **Validation Errors**
   - Action: Review user input patterns
   - Consider: Improving frontend validation

## Log Aggregation Tools

### 1. ELK Stack (Elasticsearch, Logstash, Kibana)

**Logstash Configuration:**
```ruby
input {
  file {
    path => "/path/to/logs/combined.log"
    codec => json
  }
}

filter {
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "topic-similarity-%{+YYYY.MM.dd}"
  }
}
```

**Kibana Queries:**
```
# All errors
level: "error"

# Errors on specific endpoint
level: "error" AND path: "/api/similarity/check"

# Slow requests
processingTime: >2000

# Errors in last 24 hours
timestamp: [now-24h TO now] AND level: "error"
```

### 2. Splunk

**Search Queries:**
```
# Error rate over time
index=topic-similarity level=error | timechart count

# Top error messages
index=topic-similarity level=error | top message

# Average response time
index=topic-similarity | stats avg(processingTime) by path
```

### 3. CloudWatch (AWS)

**Log Insights Queries:**
```
# Error count by hour
fields @timestamp, level, message
| filter level = "error"
| stats count() by bin(1h)

# Slow requests
fields @timestamp, path, processingTime
| filter processingTime > 2000
| sort processingTime desc
```

## Custom Monitoring Scripts

### Error Alert Script

```bash
#!/bin/bash
# error-alert.sh - Alert on high error rate

LOG_FILE="logs/error.log"
THRESHOLD=10
TIME_WINDOW=300  # 5 minutes in seconds

# Count errors in last 5 minutes
ERROR_COUNT=$(find $LOG_FILE -mmin -5 -exec cat {} \; | jq -s 'length')

if [ $ERROR_COUNT -gt $THRESHOLD ]; then
  echo "ALERT: $ERROR_COUNT errors in last 5 minutes"
  # Send alert (email, Slack, PagerDuty, etc.)
  # curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  #   -d "{\"text\": \"High error rate: $ERROR_COUNT errors\"}"
fi
```

### Performance Monitor Script

```bash
#!/bin/bash
# performance-monitor.sh - Monitor response times

LOG_FILE="logs/combined.log"

# Calculate average response time
AVG_TIME=$(cat $LOG_FILE | jq -s 'map(select(.processingTime)) | map(.processingTime) | add / length')

echo "Average response time: ${AVG_TIME}ms"

# Alert if average > 2 seconds
if (( $(echo "$AVG_TIME > 2000" | bc -l) )); then
  echo "WARNING: High average response time"
fi
```

## Best Practices

### 1. Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# /etc/logrotate.d/topic-similarity
/path/to/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 nodejs nodejs
  sharedscripts
  postrotate
    systemctl reload topic-similarity
  endscript
}
```

### 2. Structured Logging

Always include context in logs:

```javascript
logger.error('Database query failed', {
  query: 'SELECT * FROM topics',
  error: error.message,
  userId: req.user?.id,
  timestamp: new Date().toISOString()
});
```

### 3. Sensitive Data

Never log sensitive information:

```javascript
// ❌ Bad
logger.info('User login', { password: user.password });

// ✅ Good
logger.info('User login', { userId: user.id, email: user.email });
```

### 4. Performance Impact

Minimize logging overhead:

```javascript
// ❌ Bad - expensive operation in log
logger.debug('Data:', JSON.stringify(largeObject));

// ✅ Good - only log when needed
if (logger.level === 'debug') {
  logger.debug('Data:', JSON.stringify(largeObject));
}
```

## Troubleshooting Common Issues

### Issue 1: Logs Not Appearing

**Symptoms:** No logs in console or files

**Solutions:**
1. Check log level configuration
2. Verify file permissions on logs directory
3. Ensure Winston is properly initialized
4. Check for console.log overrides

### Issue 2: Log Files Growing Too Large

**Symptoms:** Disk space issues, slow log queries

**Solutions:**
1. Implement log rotation
2. Reduce log level in production
3. Archive old logs to cold storage
4. Use log aggregation service

### Issue 3: Missing Context in Logs

**Symptoms:** Difficult to debug issues

**Solutions:**
1. Add request ID to all logs
2. Include user context when available
3. Log request/response for errors
4. Add timing information

## Integration with Monitoring Services

### 1. Datadog

```javascript
const winston = require('winston');
const DatadogWinston = require('datadog-winston');

logger.add(new DatadogWinston({
  apiKey: process.env.DATADOG_API_KEY,
  hostname: 'topic-similarity-api',
  service: 'api',
  ddsource: 'nodejs'
}));
```

### 2. New Relic

```javascript
require('newrelic');
// Winston logs automatically sent to New Relic
```

### 3. Sentry

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN
});

// Log errors to Sentry
logger.on('error', (error) => {
  Sentry.captureException(error);
});
```

## Metrics to Track

### Application Metrics

1. **Error Rate**: Percentage of requests resulting in errors
2. **Response Time**: Average, p50, p95, p99 response times
3. **Request Volume**: Requests per second/minute/hour
4. **Success Rate**: Percentage of successful requests

### Business Metrics

1. **Similarity Checks**: Number of checks performed
2. **High Risk Detections**: Number of high-risk topics found
3. **Algorithm Usage**: Distribution of algorithm usage
4. **User Activity**: Active users, peak usage times

### Infrastructure Metrics

1. **CPU Usage**: Server CPU utilization
2. **Memory Usage**: Application memory consumption
3. **Disk I/O**: Log file write performance
4. **Network**: API response times, external service latency

## Conclusion

Effective log monitoring is crucial for maintaining a healthy production system. Regular review of logs, setting up appropriate alerts, and using log aggregation tools will help you quickly identify and resolve issues.

**Key Takeaways:**
- Monitor error rates and set up alerts
- Use structured logging with context
- Implement log rotation to manage disk space
- Integrate with monitoring services for better visibility
- Review logs regularly to identify trends

---

**Last Updated:** February 9, 2026  
**Version:** 1.0.0
