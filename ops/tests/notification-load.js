import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    acceptance: { executor: 'constant-arrival-rate', rate: Number(__ENV.RATE || 5), timeUnit: '1s', duration: __ENV.DURATION || '2m', preAllocatedVUs: 10, maxVUs: 50 },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2500'],
  },
};

export default function () {
  const idempotencyKey = `load-${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(
    `${__ENV.BASE_URL}/api/v1/workspaces/${__ENV.WORKSPACE_ID}/notifications/trigger`,
    JSON.stringify({ templateId: __ENV.TEMPLATE_ID, subscriberExternalId: __ENV.SUBSCRIBER_EXTERNAL_ID, payload: { source: 'load-test' }, options: { channels: ['IN_APP'] } }),
    { headers: { 'content-type': 'application/json', 'x-api-key': __ENV.API_KEY, 'idempotency-key': idempotencyKey }, tags: { journey: 'notification-acceptance' } },
  );
  check(response, { 'durably accepted': (result) => result.status === 202 });
}
